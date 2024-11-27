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

export async function inferTypesFromDatasetId(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  dataset_id: string
) {
  if (!index_type || !dataset_id) {
    return {
      inferredSliceType: undefined,
      inferredDataType: null,
    };
  }

  const ds = await api.fetchDatasetsByIndexType();
  const dataset = ds[index_type].find((d) => d.id === dataset_id);

  if (!dataset) {
    window.console.warn(`Unknown dataset "${dataset_id}"!`);
    return {
      inferredSliceType: undefined,
      inferredDataType: null,
    };
  }

  return {
    inferredSliceType: dataset.slice_type,
    inferredDataType: dataset.data_type,
  };
}

export async function inferDatasetId(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  slice_type: string | null,
  dataType: string | null
) {
  if (!index_type || !slice_type || !dataType) {
    return undefined;
  }

  const datasets = await api.fetchDatasetsByIndexType();
  const ids = new Set<string>();

  datasets[index_type].forEach((dataset) => {
    if (dataset.slice_type === slice_type && dataset.data_type === dataType) {
      ids.add(dataset.id);
    }
  });

  return ids.size === 1 ? [...ids][0] : undefined;
}

export async function findDataType(
  api: ReturnType<typeof useDataExplorerApi>,
  dataset_id: string | null
) {
  const datasets = await api.fetchDatasets();
  const dataset = datasets.find((d) => d.id === dataset_id);

  return dataset?.data_type || null;
}

export async function findHighestPriorityDataset(
  api: ReturnType<typeof useDataExplorerApi>,
  index_type: string | null,
  slice_type: string,
  dataType: string
) {
  if (!index_type) {
    return undefined;
  }

  const datasets = await api.fetchDatasetsByIndexType();
  const dataset = datasets[index_type]
    .filter((d) => {
      return (
        d.slice_type === slice_type &&
        d.data_type === dataType &&
        d.priority !== null
      );
    })
    .sort((a, b) => {
      return (a.priority as number) - (b.priority as number);
    })[0];

  return dataset?.id;
}
