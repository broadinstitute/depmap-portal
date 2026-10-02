import React, { useMemo, useState } from "react";
import { ModelFit } from "@depmap/types";
import CorrelationMeter from "src/predictability/components/CorrelationMeter";
import { useDatasetNames } from "../hooks/useDatasetNames";
import { useFeatureLabels } from "../hooks/useFeatureLabels";
import { getFeatureLabel } from "../featureLabel";
import FeatureDetailPlots from "./FeatureDetailPlots";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  fit: ModelFit;
  dimType: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
  actualsFeatureLabel: string;
}

export default function FeatureTable({
  fit,
  dimType,
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
          <th>Feature</th>
          <th>Relative Importance</th>
          <th>Correlation</th>
          <th>Dataset Name</th>
        </tr>
      </thead>
      <tbody>
        {fit.top_features.map((feature, index) => {
          const key = `${feature.feature_dataset_id}:${feature.feature_given_id}`;
          const isExpanded = expandedIndex === index;

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
                  {getFeatureLabel(feature, featureLabels)}
                </td>
                <td>
                  <span className={styles.correlationValue}>
                    {(feature.importance * 100).toFixed(1)}%
                  </span>
                  <CorrelationMeter
                    correlation={feature.importance}
                    useGradedColorScheme
                    showLabel={false}
                    rightSideOnly
                  />
                </td>
                <td>
                  <span className={styles.correlationValue}>
                    {feature.correlation_with_actual.toFixed(2)}
                  </span>
                  <CorrelationMeter
                    correlation={feature.correlation_with_actual}
                    useGradedColorScheme
                    showLabel={false}
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
