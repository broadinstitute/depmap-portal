import React, { useMemo, useState } from "react";
import { ModelFit } from "@depmap/types";
import StyledMeter from "src/common/components/StyledMeter";
import { useDatasetNames } from "../hooks/useDatasetNames";
import { useFeatureLabels } from "../hooks/useFeatureLabels";
import { getFeatureLabel } from "../featureLabel";
import { getFeatureRelationship } from "../featureRelationship";
import FeatureDetailPlots from "./FeatureDetailPlots";
import FeatureRelationshipIcon from "./FeatureRelationshipIcon";
import FeatureRelationshipLegend from "./FeatureRelationshipLegend";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  fit: ModelFit;
  dimType: string;
  dimTypeGivenId: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
  actualsFeatureLabel: string;
}

export default function FeatureTable({
  fit,
  dimType,
  dimTypeGivenId,
  actualsDatasetId,
  actualsFeatureGivenId,
  actualsFeatureLabel,
}: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const datasetIds = useMemo(
    () => [...new Set(fit.top_features.map((f) => f.feature_dataset_id))],
    [fit]
  );
  const datasetNames = useDatasetNames(datasetIds);
  const featureLabels = useFeatureLabels(datasetIds);

  return (
    <table className={styles.featureTable}>
      <thead>
        <tr>
          <th>
            Feature <FeatureRelationshipLegend dimType={dimType} />
          </th>
          <th>Relative Importance</th>
          <th>Correlation</th>
          <th>Feature Type</th>
        </tr>
      </thead>
      <tbody>
        {fit.top_features.map((feature, index) => {
          const key = `${feature.feature_dataset_id}:${feature.feature_given_id}`;
          const isExpanded = expandedIndex === index;
          const relationship = getFeatureRelationship(
            feature,
            dimType,
            dimTypeGivenId
          );

          return (
            <React.Fragment key={key}>
              <tr
                className={styles.featureRow}
                onClick={() =>
                  setExpandedIndex((prev) => (prev === index ? null : index))
                }
              >
                <td>
                  <span className={styles.expandIndicator}>
                    {isExpanded ? "−" : "+"}
                  </span>
                  <FeatureRelationshipIcon relationship={relationship} />{" "}
                  {getFeatureLabel(feature, featureLabels)}
                </td>
                <td>
                  <StyledMeter
                    value={feature.importance}
                    min={0}
                    max={1}
                    percentage
                    showLabel
                    toFixed={1}
                  />
                </td>
                <td>
                  <StyledMeter
                    value={feature.correlation_with_actual}
                    min={-1}
                    max={1}
                    showLabel
                    toFixed={3}
                  />
                </td>
                <td>
                  {datasetNames[feature.feature_dataset_id] ||
                    feature.feature_dataset_id}
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={4}>
                    <FeatureDetailPlots
                      feature={feature}
                      featureLabel={getFeatureLabel(feature, featureLabels)}
                      dimType={dimType}
                      actualsDatasetId={actualsDatasetId}
                      actualsFeatureGivenId={actualsFeatureGivenId}
                      actualsFeatureLabel={actualsFeatureLabel}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
