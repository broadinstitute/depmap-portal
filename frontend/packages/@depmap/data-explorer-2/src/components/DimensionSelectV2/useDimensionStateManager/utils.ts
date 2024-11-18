import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";

export async function validateDimension(
  dimension: Partial<DataExplorerPlotConfigDimensionV2>
) {
  if (dimension.dataset_id) {
    // TODO: Validate that this is a known dataset and that it has the expected
    // slice_type.
  }
}

export async function inferSliceType(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  dataType: string | null
) {
  if (!index_type || !dataType) {
    return undefined;
  }

  const ds = await api.fetchDatasetsByIndexType();
  const sliceTypes = new Set<string>();

  ds[index_type].forEach((dataset) => {
    if (dataset.data_type === dataType) {
      sliceTypes.add(dataset.slice_type);
    }
  });

  return sliceTypes.size === 1 ? [...sliceTypes][0] : undefined;
}

export async function inferDataType(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  slice_type: string | null
) {
  if (!index_type || !slice_type) {
    return null;
  }

  const ds = await api.fetchDatasetsByIndexType();
  const dataTypes = new Set<string>();

  ds[index_type].forEach((dataset) => {
    if (dataset.slice_type === slice_type) {
      dataTypes.add(dataset.data_type);
    }
  });

  return dataTypes.size === 1 ? [...dataTypes][0] : null;
}
