import React from "react";
import MiniScatterPlot from "./MiniScatterPlot";
import { PredictiveFeature } from "@depmap/types";
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
      <MiniScatterPlot
        dimType={dimType}
        xAxis={{
          datasetId: feature.feature_dataset_id,
          featureGivenId: feature.feature_given_id,
          featureLabel,
          axisLabel: featureLabel,
        }}
        yAxis={{
          datasetId: actualsDatasetId,
          featureGivenId: actualsFeatureGivenId,
          featureLabel: actualsFeatureLabel,
          axisLabel: "Gene Effect",
        }}
      />
      <PlaceholderBox label="Dataset correlation: actual vs. feature — TODO" />
      <PlaceholderBox label="Feature rank plot — TODO" />
    </div>
  );
}
