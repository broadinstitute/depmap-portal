import { getUrlPrefix, isElara } from "@depmap/globals";
import {
  FeatureType,
  FeatureTypeUpdateArgs,
  SampleType,
  SampleTypeUpdateArgs,
} from "@depmap/types";
import createJsonClient from "./createJsonClient";

const { getJson, deleteJson, patchMultipart, postMultipart } = createJsonClient(
  `${getUrlPrefix()}${isElara ? "" : "/breadbox"}`
);

function getSampleTypes() {
  return getJson<SampleType[]>("/types/sample");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postSampleType(sampleTypeArgs: any) {
  const args = { ...sampleTypeArgs };

  if ("annotation_type_mapping" in args) {
    args.annotation_type_mapping = JSON.stringify(args.annotation_type_mapping);
  }
  return postMultipart<SampleType>("/types/sample", args);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postFeatureType(featureTypeArgs: any) {
  const args = { ...featureTypeArgs };

  if ("annotation_type_mapping" in args) {
    args.annotation_type_mapping = JSON.stringify(args.annotation_type_mapping);
  }
  return postMultipart<FeatureType>("/types/feature", args);
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
