import { MetadataSlices } from "../../api";

export const slicePrefix = (slices: MetadataSlices, value: string) => {
  let out = "";

  Object.keys(slices).forEach((sliceId) => {
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

export const getDatasetIdFromSlice = (
  slices: MetadataSlices,
  value: string
) => {
  return slicePrefix(slices, value).replace("slice/", "").slice(0, -1);
};

export const getMetadataSliceTypeLabelFromSlice = (
  slices: MetadataSlices,
  value: string
) => {
  let out = "";

  Object.entries(slices).forEach(([sliceId, descriptor]) => {
    if (sliceId === slicePrefix(slices, value)) {
      out = descriptor.sliceTypeLabel as string;
    }
  });

  return out;
};

export const containsPartialSlice = (
  slices: MetadataSlices,
  value: string | null
) => {
  if (!value) {
    return false;
  }

  return Object.entries(slices).some(
    ([sliceId, sliceInfo]) =>
      sliceId === slicePrefix(slices, value) && sliceInfo.isPartialSliceId
  );
};

export const getOptions = (slices: MetadataSlices) => {
  const options: Record<string, string> = {};

  Object.keys(slices)
    .filter((slice_id: string) => !slices[slice_id].isHighCardinality)
    .forEach((slice_id) => {
      options[slice_id] = slices[slice_id].name;
    });

  return options;
};
