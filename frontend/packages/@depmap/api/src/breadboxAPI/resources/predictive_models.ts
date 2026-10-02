import {
  PredictiveModelConfigOut,
  PredictiveModelResultOut,
  PredictiveModelsResponse,
} from "@depmap/types";
import { uri } from "../../uriTemplateTag";
import { getJson } from "../client";

export function getPredictiveModelConfigs() {
  return getJson<PredictiveModelConfigOut[]>("/temp/predictive_models/configs");
}

export function getPredictiveModelResults() {
  return getJson<PredictiveModelResultOut[]>("/temp/predictive_models");
}

export async function getPredictiveModelsForFeature(
  datasetId: string,
  featureGivenId: string
) {
  const result = await getJson<
    | PredictiveModelsResponse
    // WORKAROUND: Breadbox responds with a 200 even though there was an error.
    | { detail: unknown }
  >(uri`/temp/predictive_models/feature/${datasetId}/${featureGivenId}`);

  if ("detail" in result) {
    throw new Error(JSON.stringify(result.detail));
  }

  return result;
}
