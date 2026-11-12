import React from "react";
import TitledPlot from "./TitledPlot";
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
      <TitledPlot
        title="Feature vs. gene effect"
        tooltip="Each point is a cell line, plotted by this feature's value (x) against the observed gene effect (y). A clear trend shows that the feature is directly related to dependency, which is why the model can use it as a predictor."
      >
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
      </TitledPlot>
      <TitledPlot
        title="Correlation with feature vs. with gene effect"
        tooltip="Each point is another feature from the same dataset, plotted by its correlation with this feature (x) and with the gene effect (y). Features that lie along the diagonal track both, which suggests this feature's predictive power may be shared with correlated features rather than unique to it."
      >
        <DatasetCorrelationScatterPlot
          featureDatasetId={feature.feature_dataset_id}
          featureGivenId={feature.feature_given_id}
          featureLabel={featureLabel}
          actualsDatasetId={actualsDatasetId}
          actualsFeatureGivenId={actualsFeatureGivenId}
        />
      </TitledPlot>
      <TitledPlot
        title="Rank among features"
        tooltip="All features in this feature's dataset ranked by their correlation with the gene effect, with this feature highlighted in red. A feature near either end of the curve is among the strongest individual predictors in its dataset; one near the middle is only weakly related on its own."
      >
        <FeatureRankPlot
          featureDatasetId={feature.feature_dataset_id}
          featureGivenId={feature.feature_given_id}
          featureLabel={featureLabel}
          actualsDatasetId={actualsDatasetId}
          actualsFeatureGivenId={actualsFeatureGivenId}
        />
      </TitledPlot>
    </div>
  );
}
