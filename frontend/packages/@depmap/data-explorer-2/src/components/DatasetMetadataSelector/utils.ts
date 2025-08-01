import type { DeprecatedDataExplorerApiResponse } from "../../services/deprecatedDataExplorerAPI";

type MetadataSlices = DeprecatedDataExplorerApiResponse["fetchMetadataSlices"];

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
  value: string | null
) => {
  if (!value) {
    return "";
  }

  let out = "";

  Object.entries(slices).forEach(([sliceId, descriptor]) => {
    if (sliceId === slicePrefix(slices, value)) {
      out = descriptor.sliceTypeLabel as string;
    }
  });

  return out;
};

export const getValueTypeFromSlice = (
  slices: MetadataSlices,
  value: string | null
) => {
  if (!value) {
    return null;
  }

  let out = null;

  Object.entries(slices).forEach(([sliceId, descriptor]) => {
    if (sliceId === slicePrefix(slices, value)) {
      out = descriptor.valueType as string;
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

export const makeSliceComparator = (slices: MetadataSlices) => (
  keyA: keyof MetadataSlices,
  keyB: keyof MetadataSlices
) => {
  const sliceA = slices[keyA];
  const sliceB = slices[keyB];

  if (sliceA.isIdColumn) {
    return -1;
  }

  if (sliceB.isIdColumn) {
    return 1;
  }

  if (sliceA.isLabelColumn) {
    return -1;
  }

  const nameA = sliceA.name;
  const nameB = sliceB.name;

  if (nameA === "Lineage Sub-subtype" && nameB === "Lineage Subtype") {
    return 1;
  }

  if (nameA === "OncotreeLineage") {
    return -1;
  }

  if (nameA === "OncotreePrimaryDisease" && nameB !== "OncotreeLineage") {
    return -1;
  }

  if (nameA === "OncotreeSubtype" && nameB !== "OncotreePrimaryDisease") {
    return -1;
  }

  return nameA.toLowerCase() < nameB.toLowerCase() ? -1 : 1;
};

export const getOptions = (slices: MetadataSlices) => {
  const options: Record<string, string> = {};

  Object.keys(slices)
    .filter((slice_id: string) => !slices[slice_id].isHighCardinality)
    .sort(makeSliceComparator(slices))
    .forEach((slice_id) => {
      options[slice_id] = slices[slice_id].name;
    });

  return options;
};
