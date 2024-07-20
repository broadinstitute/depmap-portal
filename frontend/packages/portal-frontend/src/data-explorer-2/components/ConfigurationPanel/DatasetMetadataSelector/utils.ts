import metadataSlices from "src/data-explorer-2/json/metadata-slices.json";

export const slicePrefix = (value: string, entity_type: string) => {
  const md = (metadataSlices as Record<string, object>)[entity_type];
  let out = "";

  Object.keys(md).forEach((sliceId) => {
    if (value.includes(sliceId)) {
      out = sliceId;
    }
  });

  return out;
};

export const sliceLabel = (value: string) => {
  if (value.endsWith("/")) {
    return null;
  }

  const label = value.split("/").slice(-2)[0];
  return label ? decodeURIComponent(label) : null;
};

export const getDatasetIdFromSlice = (value: string, entity_type: string) => {
  return slicePrefix(value, entity_type).replace("slice/", "").slice(0, -1);
};

export const getMetadataEntityTypeLabelFromSlice = (
  value: string,
  entity_type: string
) => {
  const md = (metadataSlices as Record<string, object>)[entity_type];
  let out = "";

  Object.entries(md).forEach(([sliceId, descriptor]) => {
    if (sliceId === slicePrefix(value, entity_type)) {
      out = descriptor.entityTypeLabel;
    }
  });

  return out;
};

export const containsPartialSlice = (
  value: string | null,
  entity_type: string
) => {
  if (!value) {
    return false;
  }

  const md = (metadataSlices as Record<string, object>)[entity_type];

  return Object.entries(md).some(
    ([sliceId, descriptor]) =>
      sliceId === slicePrefix(value, entity_type) && descriptor.isPartialSliceId
  );
};

export const getOptions = (entity_type: string) => {
  const md = metadataSlices;
  const dimensionMetadata: Record<
    string,
    { name: string; isHighCardinality?: boolean }
  > = md[entity_type as "depmap_model" | "gene" | "compound_experiment"];

  const options: Record<string, string> = {};

  Object.keys(dimensionMetadata || {})
    .filter(
      (slice_id: string) => !dimensionMetadata[slice_id].isHighCardinality
    )
    .forEach((slice_id) => {
      options[slice_id] = dimensionMetadata[slice_id].name;
    });

  return options;
};
