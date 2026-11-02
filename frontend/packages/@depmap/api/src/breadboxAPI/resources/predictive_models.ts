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

export function getPredictiveModelsForFeature(
  datasetId: string,
  featureGivenId: string
) {
  return getJson<PredictiveModelsResponse>(
    uri`/temp/predictive_models/feature/${datasetId}/${featureGivenId}`
  );
}
