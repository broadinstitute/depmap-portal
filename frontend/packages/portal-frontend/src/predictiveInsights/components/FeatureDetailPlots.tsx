import React from "react";
import { MiniDataExplorerPlot } from "@depmap/data-explorer-2";
import { PredictiveFeature } from "@depmap/types";
import { buildFeatureVsGeneEffectPlotConfig } from "../dataExplorerPlotConfig";
import PlaceholderBox from "./PlaceholderBox";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  feature: PredictiveFeature;
  featureLabel: string;
  dimType: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
  actualsFeatureLabel: string;
}

export default function FeatureDetailPlots({
  feature,
  featureLabel,
  dimType,
  actualsDatasetId,
  actualsFeatureGivenId,
  actualsFeatureLabel,
}: Props) {
  return (
    <div className={styles.featureDetailPlotsGrid}>
      <MiniDataExplorerPlot
        plotConfig={buildFeatureVsGeneEffectPlotConfig({
          dimType,
          featureDatasetId: feature.feature_dataset_id,
          featureGivenId: feature.feature_given_id,
          featureLabel,
          actualsDatasetId,
          actualsFeatureGivenId,
          actualsFeatureLabel,
        })}
        xAxisLabel={featureLabel}
        yAxisLabel="Gene Effect"
      />
      <PlaceholderBox label="Dataset correlation: actual vs. feature — TODO" />
      <PlaceholderBox label="Feature rank plot — TODO" />
    </div>
  );
}
