import { ComputeResponse, UnivariateAssociationsParams } from "@depmap/compute";
import { postJson } from "../client";

type UnivariateAssociationsParamsBB = Omit<
  UnivariateAssociationsParams,
  "queryId"
> & {
  queryDatasetId?: string;
  queryFeatureId?: string;
};

export function computeUnivariateAssociations(
  config: UnivariateAssociationsParamsBB
) {
  return postJson<ComputeResponse>(
    "/compute/compute_univariate_associations",
    config
  );
}
