import React, { useMemo } from "react";
import { MiniCorrelationHeatmap } from "@depmap/data-explorer-2";
import { ModelFit } from "@depmap/types";
import { useFeatureLabels } from "../hooks/useFeatureLabels";
import { getFeatureLabel } from "../featureLabel";

interface Props {
  fit: ModelFit;
  dimType: string;
}

// Caps the number of features so the heatmap stays readable and doesn't
// require too many getDimensionData round trips.
const MAX_FEATURES = 10;

export default function ModelCorrelationHeatmap({ fit, dimType }: Props) {
  const topFeatures = fit.top_features.slice(0, MAX_FEATURES);

  const datasetIds = useMemo(
    () => [...new Set(topFeatures.map((f) => f.feature_dataset_id))],
    [topFeatures]
  );
  const featureLabels = useFeatureLabels(datasetIds);

  const features = topFeatures.map((feature) => ({
    datasetId: feature.feature_dataset_id,
    featureGivenId: feature.feature_given_id,
    featureLabel: getFeatureLabel(feature, featureLabels),
  }));

  return <MiniCorrelationHeatmap dimType={dimType} features={features} />;
}
