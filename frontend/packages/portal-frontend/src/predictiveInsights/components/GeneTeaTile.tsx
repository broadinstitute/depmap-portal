import React, { useMemo, useState } from "react";
import { Tab, Tabs } from "react-bootstrap";
import { GeneTea } from "@depmap/data-explorer-2";
import { ModelConfigOut } from "@depmap/types";
import { ScreenTypeData } from "../hooks/usePredictiveInsightsData";
import { useDatasetNames } from "../hooks/useDatasetNames";
import { useFeatureLabels } from "../hooks/useFeatureLabels";
import { getFeatureLabel } from "../featureLabel";
import { getModelColor } from "../modelColors";
import TopFeaturesBarChart, { TopFeatureBarDatum } from "./TopFeaturesBarChart";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  title: string;
  screenType: ScreenTypeData;
  configs: ModelConfigOut[];
}

const MAX_TOP_FEATURES = 100;

export default function GeneTeaTile({ title, screenType, configs }: Props) {
  const [showSearchTerms, setShowSearchTerms] = useState(false);

  const topFeatures = useMemo(() => {
    const all = screenType.response.model_fits.flatMap((fit) =>
      fit.top_features.map((feature) => ({
        feature,
        configName: fit.config_name,
      }))
    );

    all.sort((a, b) => b.feature.importance - a.feature.importance);

    return all.slice(0, MAX_TOP_FEATURES);
  }, [screenType]);

  const datasetIds = useMemo(
    () => [
      ...new Set(topFeatures.map(({ feature }) => feature.feature_dataset_id)),
    ],
    [topFeatures]
  );
  const datasetNames = useDatasetNames(datasetIds);
  const featureLabels = useFeatureLabels(datasetIds);

  const barData: TopFeatureBarDatum[] = useMemo(
    () =>
      topFeatures.map(({ feature, configName }) => ({
        label: getFeatureLabel(feature, featureLabels),
        importance: feature.importance,
        modelName: configName,
        color: getModelColor(configName, configs),
      })),
    [topFeatures, configs, featureLabels]
  );

  // Open question (see spec doc): mapping an arbitrary feature back to "the
  // gene it references" isn't well-defined for non-gene-level feature types.
  // For now this uses the feature's own label, which is only exactly right
  // for gene-level features.
  const selectedLabels = useMemo(
    () =>
      new Set(
        topFeatures.map(({ feature }) =>
          getFeatureLabel(feature, featureLabels)
        )
      ),
    [topFeatures, featureLabels]
  );

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">{title}</h2>
        <Tabs
          defaultActiveKey="top-features"
          id={`gene-tea-tile-tabs-${title}`}
        >
          <Tab eventKey="top-features" title="Top Features Overall">
            <TopFeaturesBarChart features={barData} />
          </Tab>
          <Tab eventKey="gene-tea" title="GeneTEA Results">
            <GeneTea
              selectedLabels={selectedLabels}
              onClickColorByContext={() => {}}
            />
            <button
              type="button"
              className={styles.toggleSearchTerms}
              onClick={() => setShowSearchTerms((prev) => !prev)}
            >
              {showSearchTerms ? "Hide" : "Show"} search terms
            </button>
            {showSearchTerms && (
              <table className={styles.searchTermsTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Feature Type</th>
                    <th>Importance Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {topFeatures.map(({ feature }, index) => (
                    <tr
                      key={`${feature.feature_dataset_id}:${feature.feature_given_id}`}
                    >
                      <td>{getFeatureLabel(feature, featureLabels)}</td>
                      <td>
                        {datasetNames[feature.feature_dataset_id] ||
                          feature.feature_dataset_id}
                      </td>
                      <td>{index + 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tab>
        </Tabs>
      </div>
    </article>
  );
}
