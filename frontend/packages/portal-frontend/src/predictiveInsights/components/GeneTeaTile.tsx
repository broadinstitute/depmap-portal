import React, { useMemo, useState } from "react";
import { Tab, Tabs } from "react-bootstrap";
import { GeneTea } from "@depmap/data-explorer-2";
import { ModelConfigOut } from "@depmap/types";
import { ScreenTypeData } from "../hooks/usePredictiveInsightsData";
import { useDatasetNames } from "../hooks/useDatasetNames";
import { useFeatureLabels } from "../hooks/useFeatureLabels";
import {
  normKey,
  useFeatureImportanceNorms,
} from "../hooks/useFeatureImportanceNorms";
import InfoIcon from "src/common/components/InfoIcon";
import { Spinner } from "@depmap/common-components";
import { getScreenTypeLabel } from "../screenTypeLabel";
import { getFeatureLabel } from "../featureLabel";
import { getModelColor } from "../modelColors";
import TopFeaturesBarChart, { TopFeatureBarDatum } from "./TopFeaturesBarChart";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  title: string;
  screenType: ScreenTypeData;
  configs: ModelConfigOut[];
}

const MAX_TOP_FEATURES = 25;

export default function GeneTeaTile({ title, screenType, configs }: Props) {
  const [showSearchTerms, setShowSearchTerms] = useState(false);

  const topFeatures = useMemo(() => {
    const all = screenType.response.model_fits.flatMap((fit) =>
      fit.top_features.map((feature) => ({
        feature,
        configName: fit.config_name,
      }))
    );

    // The same feature can show up as a top feature for more than one
    // model. Rank by each feature's *total* importance across all the
    // models it appears in (not each row's own value), so the same feature
    // doesn't get scattered across the list based on which model's score
    // happened to be higher.
    const featureKey = (f: typeof all[number]["feature"]) =>
      `${f.feature_dataset_id}:${f.feature_given_id}`;

    const totalImportanceByFeature = new Map<string, number>();
    all.forEach(({ feature }) => {
      const key = featureKey(feature);
      totalImportanceByFeature.set(
        key,
        (totalImportanceByFeature.get(key) || 0) + feature.importance
      );
    });

    all.sort((a, b) => {
      const totalDiff =
        totalImportanceByFeature.get(featureKey(b.feature))! -
        totalImportanceByFeature.get(featureKey(a.feature))!;

      return totalDiff !== 0
        ? totalDiff
        : b.feature.importance - a.feature.importance;
    });

    return all.slice(0, MAX_TOP_FEATURES);
  }, [screenType]);

  const datasetIds = useMemo(
    () => [
      ...new Set(
        screenType.response.model_fits.flatMap((fit) =>
          fit.top_features.map((f) => f.feature_dataset_id)
        )
      ),
    ],
    [screenType]
  );
  const datasetNames = useDatasetNames(datasetIds);
  const featureLabels = useFeatureLabels(datasetIds);

  const { norms, error: normsError } = useFeatureImportanceNorms();

  // Normalized feature importance = correlation^2 / norm * model accuracy,
  // computed per (model, feature) and stacked by model for each feature label.
  const barData: TopFeatureBarDatum[] = useMemo(() => {
    if (!norms) {
      return [];
    }

    // Norms are keyed by short screen names like "crispr" or "oncref".
    const screenName = getScreenTypeLabel(screenType)
      .replace(/^PRISM\s+/i, "")
      .toLowerCase();

    const byLabel = new Map<string, TopFeatureBarDatum>();

    screenType.response.model_fits.forEach((fit) => {
      const norm = norms[normKey(screenName, fit.config_name)];

      if (!norm) {
        // eslint-disable-next-line no-console
        console.warn(
          `No normalization factor for screen "${screenName}" and model "${fit.config_name}"; skipping.`
        );
        return;
      }

      fit.top_features.forEach((feature) => {
        const label = getFeatureLabel(feature, featureLabels);
        const value =
          (feature.correlation_with_actual ** 2 / norm) *
          fit.prediction_actual_correlation;
        const datasetName =
          datasetNames[feature.feature_dataset_id] ||
          feature.feature_dataset_id;

        let datum = byLabel.get(label);
        if (!datum) {
          datum = { label, total: 0, segments: [] };
          byLabel.set(label, datum);
        }

        let segment = datum.segments.find(
          (seg) => seg.modelName === fit.config_name
        );
        if (!segment) {
          segment = {
            modelName: fit.config_name,
            value: 0,
            color: getModelColor(fit.config_name, configs),
            datasetNames: [],
          };
          datum.segments.push(segment);
        }

        segment.value += value;
        datum.total += value;
        if (!segment.datasetNames.includes(datasetName)) {
          segment.datasetNames.push(datasetName);
        }
      });
    });

    return [...byLabel.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_TOP_FEATURES);
  }, [norms, screenType, configs, featureLabels, datasetNames]);

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

  let topFeaturesContent: React.ReactNode;
  if (normsError) {
    topFeaturesContent = (
      <div className={styles.errorBanner}>
        Could not load the normalization factors.
      </div>
    );
  } else if (!norms) {
    topFeaturesContent = <Spinner position="static" />;
  } else {
    topFeaturesContent = <TopFeaturesBarChart features={barData} />;
  }

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">{title}</h2>
        <Tabs
          defaultActiveKey="top-features"
          id={`gene-tea-tile-tabs-${title}`}
        >
          <Tab
            eventKey="top-features"
            title={
              <span>
                Top Features Overall
                <InfoIcon
                  popoverContent={
                    <div>
                      <p>
                        <b>Normalized feature importance</b> is computed for
                        every feature in each model&apos;s list of top features
                        as:
                      </p>
                      <p>
                        <i>
                          (correlation between the feature and the screen data)²
                          ÷ norm × model accuracy
                        </i>
                      </p>
                      <ul>
                        <li>
                          <b>correlation</b> is the feature&apos;s correlation
                          with the observed data, squared so that positive and
                          negative relationships count equally.
                        </li>
                        <li>
                          <b>norm</b> is a normalization factor specific to each
                          screen and model, so that models with different
                          numbers of features can be compared.
                        </li>
                        <li>
                          <b>model accuracy</b> is the correlation between the
                          model&apos;s predictions and the observed data.
                        </li>
                      </ul>
                      <p>
                        Each bar is one feature label. Its segments are the
                        values from each model that listed it as a top feature,
                        stacked and colored by model. The longest bars (largest
                        totals) are shown, up to {MAX_TOP_FEATURES}.
                      </p>
                    </div>
                  }
                  popoverId={`top-features-info-${title.replace(/\W+/g, "-")}`}
                  trigger={["click"]}
                  placement="bottom"
                />
              </span>
            }
          >
            {topFeaturesContent}
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
              <span className={styles.expandIndicator}>
                {showSearchTerms ? "−" : "+"}
              </span>
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
