import { ComputeResponse, UnivariateAssociationsParams } from "@depmap/compute";
import { postJson } from "../client";

export function computeUnivariateAssociations(
  config: UnivariateAssociationsParams
) {
  return postJson<ComputeResponse>(
    "/compute/compute_univariate_associations",
    config
  );
}
