import { breadboxAPI, cached } from "@depmap/api";
import { SliceQuery } from "@depmap/types";

// WORKAROUND: This works much like the Breadbox API function
// `getDimensionData` but leverages a few different endpoints, which have
// mostly overlapping functionality but don't include labels in the response.
// THe idea is to limit the size of the response as much as possible. Dimension
// types with 100K+ features, such as transcripts, present a particular
// challenge. The responses are sometimes so large that nginx refuses to serve
// them.
export async function getDimensionDataWithoutLabels(slice: SliceQuery) {
  if (slice.identifier_type === "column") {
    const wrapper = await cached(breadboxAPI).getTabularDatasetData(
      slice.dataset_id,
      {
        columns: [slice.identifier],
      }
    );

    const indexedData = wrapper[slice.identifier];

    return {
      ids: Object.keys(indexedData),
      values: Object.values(indexedData),
    };
  }

  if (["feature_id", "feature_label"].includes(slice.identifier_type)) {
    const features = await cached(breadboxAPI).getMatrixDatasetData(
      slice.dataset_id,
      {
        feature_identifier:
          slice.identifier_type === "feature_id" ? "id" : "label",
        features: [slice.identifier],
      }
    );

    if (Object.keys(features).length === 0) {
      return { ids: [] as string[], values: [] as any[] };
    }

    // The response is always an object keyed with feature IDs.
    // In this case, we've only requested one feature.
    const onlyFeatureId = Object.keys(features)[0];
    const valuesBySampleId = features[onlyFeatureId];

    return {
      ids: Object.keys(valuesBySampleId),
      values: Object.values(valuesBySampleId),
    };
  }

  if (["sample_id", "sample_label"].includes(slice.identifier_type)) {
    const features = await cached(breadboxAPI).getMatrixDatasetData(
      slice.dataset_id,
      {
        sample_identifier:
          slice.identifier_type === "sample_id" ? "id" : "label",
        samples: [slice.identifier],
      }
    );

    if (Object.keys(features).length === 0) {
      return { ids: [] as string[], values: [] as any[] };
    }

    // The response is always an object keyed with feature IDs.
    const ids = Object.keys(features);
    // Each value of `features` is itself an object with
    // only one key (the single sample we requested).
    const onlySampleId = Object.keys(features[ids[0]])[0];

    return {
      ids,
      values: Object.values(features).map(
        (valueForSampleId) => valueForSampleId[onlySampleId]
      ),
    };
  }

  throw new Error(`Bad slice query ${JSON.stringify(slice)}`);
}
