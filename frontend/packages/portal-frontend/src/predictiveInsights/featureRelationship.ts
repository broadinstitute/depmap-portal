import { PredictiveFeature } from "@depmap/types";

export type FeatureRelationship = "Self" | "Related" | "Target";

// Related vs. Target is an open question (see spec doc): there's no backend
// field to determine "biologically related gene" today, so every non-self
// feature is labeled Related for a gene, or Target for a compound (the only
// case Target applies to, per spec) — an approximation, not a real lookup.
export function getFeatureRelationship(
  feature: PredictiveFeature,
  dimType: string,
  dimTypeGivenId: string
): FeatureRelationship {
  if (feature.feature_given_id === dimTypeGivenId) {
    return "Self";
  }

  return dimType === "compound" ? "Target" : "Related";
}
