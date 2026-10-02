import { PredictiveFeature } from "@depmap/types";

// PredictiveFeature.feature_label is currently always null from breadbox (see
// useFeatureLabels.ts), so callers pass in a lookup built from the feature's
// source dataset instead.
export function getFeatureLabel(
  feature: PredictiveFeature,
  featureLabels: Record<string, string>
) {
  return (
    featureLabels[
      `${feature.feature_dataset_id}:${feature.feature_given_id}`
    ] ||
    feature.feature_label ||
    feature.feature_given_id
  );
}
