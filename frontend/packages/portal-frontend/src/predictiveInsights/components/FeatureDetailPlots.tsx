import React from "react";
import MiniScatterPlot from "./MiniScatterPlot";
import DatasetCorrelationScatterPlot from "./DatasetCorrelationScatterPlot";
import FeatureRankPlot from "./FeatureRankPlot";
import { PredictiveFeature } from "@depmap/types";
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
      <DatasetCorrelationScatterPlot
        featureDatasetId={feature.feature_dataset_id}
        featureGivenId={feature.feature_given_id}
        featureLabel={featureLabel}
        actualsDatasetId={actualsDatasetId}
        actualsFeatureGivenId={actualsFeatureGivenId}
      />
      <FeatureRankPlot
        featureDatasetId={feature.feature_dataset_id}
        featureGivenId={feature.feature_given_id}
        featureLabel={featureLabel}
        actualsDatasetId={actualsDatasetId}
        actualsFeatureGivenId={actualsFeatureGivenId}
      />
    </div>
  );
}
