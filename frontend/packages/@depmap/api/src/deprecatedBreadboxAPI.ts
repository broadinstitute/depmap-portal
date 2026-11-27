import { getUrlPrefix, isPortal } from "@depmap/globals";
import {
  FeatureType,
  FeatureTypeUpdateArgs,
  SampleType,
  SampleTypeUpdateArgs,
} from "@depmap/types";
import createJsonClient from "./createJsonClient";

const { getJson, deleteJson, patchMultipart } = createJsonClient(
  `${getUrlPrefix()}${isPortal ? "/breadbox" : ""}`
);

function getSampleTypes() {
  return getJson<SampleType[]>("/types/sample");
}

// NOTE: The implementation of the old POST /types/sample/ endpoint has been
// removed from Breadbox. Use POST /types/dimensions instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function postSampleType(_args: any): Promise<SampleType> {
  throw new Error(
    "Not implemented: POST /types/sample/ has been removed. Use POST /types/dimensions instead."
  );
}

function updateSampleType(sampleTypeArgs: Readonly<SampleTypeUpdateArgs>) {
  const sampleTypeName = sampleTypeArgs.name;
  const url = "/types/sample/" + sampleTypeName + "/metadata";

  return patchMultipart<SampleType>(url, sampleTypeArgs);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deleteSampleType(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return deleteJson<any>("/types/sample", name);
}

function getFeatureTypes() {
  return getJson<FeatureType[]>("/types/feature");
}

// NOTE: The implementation of the old POST /types/feature/ endpoint has been
// removed from Breadbox. Use POST /types/dimensions instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function postFeatureType(_args: any): Promise<FeatureType> {
  throw new Error(
    "Not implemented: POST /types/feature/ has been removed. Use POST /types/dimensions instead."
  );
}

function updateFeatureType(featureTypeArgs: Readonly<FeatureTypeUpdateArgs>) {
  const featureTypeName = featureTypeArgs.name;
  const url = "/types/feature/" + featureTypeName + "/metadata";
  return patchMultipart<FeatureType>(url, featureTypeArgs);
}

function deleteFeatureType(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return deleteJson<any>("/types/feature/", name);
}

export const deprecatedBreadboxAPI = {
  getSampleTypes,
  postSampleType,
  updateSampleType,
  deleteSampleType,
  getFeatureTypes,
  postFeatureType,
  updateFeatureType,
  deleteFeatureType,
};
