import { breadboxAPI, cached } from "@depmap/api";
import { Dataset, MatrixDataset } from "@depmap/types";
import { SliceTypeNull, SLICE_TYPE_NULL } from "./types";

interface DataExplorerDatasetDescriptor {
  data_type: string;
  id: string;
  index_type: string;
  given_id: string | null;
  name: string;
  priority: number | null;
  slice_type: string | SliceTypeNull;
  slice_type_display_name: string;
  units: string;
}

const privateDatasets: Map<string, Dataset> = new Map();

export async function fetchDatasetsByIndexType(
  index_type: string,
  // We need to also check this explicitly because it may be a transient
  // dataset or user upload (those are not returned by getDatasets()).
  selectedDatasetId: string | null
) {
  const publicDatasets = await cached(breadboxAPI).getDatasets();
  const dimTypes = await cached(breadboxAPI).getDimensionTypes();

  const datasets = [...publicDatasets, ...privateDatasets.values()];

  if (selectedDatasetId) {
    let dataset = datasets.find(
      (d) => d.id === selectedDatasetId || d.given_id === selectedDatasetId
    );

    if (!dataset) {
      try {
        dataset = await cached(breadboxAPI).getDataset(selectedDatasetId);
        datasets.push(dataset);

        if (!privateDatasets.has(selectedDatasetId)) {
          privateDatasets.set(selectedDatasetId, dataset);
        }
      } catch (e) {
        // Ignore error
      }
    }
  }

  const dimTypeDisplayNames: Record<string, string> = {};

  dimTypes.forEach((dt) => {
    dimTypeDisplayNames[dt.name] = dt.display_name || dt.name;
  });

  const out: DataExplorerDatasetDescriptor[] = [];

  datasets.forEach((dataset) => {
    // TODO: add support for tabular datasets
    if (dataset.format !== "matrix_dataset") {
      return;
    }

    // TODO: add support for other value types
    if (dataset.value_type !== "continuous") {
      return;
    }

    const {
      data_type,
      id,
      given_id,
      name,
      priority,
      units,
      sample_type_name,
      feature_type_name,
    } =
      // FIXME: The MatrixDataset definition has yet to be updated (because
      // that will have many knock-on effects) but Breadbox allows datasets
      // to have no feature type. Data Explorer needs to handle that specially.
      dataset as Omit<MatrixDataset, "feature_type_name"> & {
        feature_type_name: string | null;
      };

    const commonProperties = {
      data_type,
      given_id,
      id,
      name,
      priority,
      units,
    };

    if (index_type === sample_type_name) {
      out.push({
        ...commonProperties,
        index_type: sample_type_name,
        slice_type: feature_type_name || SLICE_TYPE_NULL,
        slice_type_display_name: feature_type_name
          ? dimTypeDisplayNames[feature_type_name]
          : SLICE_TYPE_NULL.toString(),
      });
    }

    if (index_type === feature_type_name) {
      out.push({
        ...commonProperties,
        index_type: feature_type_name,
        slice_type: sample_type_name,
        slice_type_display_name: dimTypeDisplayNames[sample_type_name],
      });
    }
  });

  return out;
}

export async function inferSliceType(
  index_type: string | null,
  dataType: string | null,
  selectedDatasetId: string | null
) {
  if (!index_type || !dataType) {
    return undefined;
  }

  const ds = await fetchDatasetsByIndexType(index_type, selectedDatasetId);
  const sliceTypes = new Set<string | SliceTypeNull>();

  ds.forEach((dataset) => {
    if (dataset.data_type === dataType) {
      sliceTypes.add(dataset.slice_type);
    }
  });

  return sliceTypes.size === 1 ? [...sliceTypes][0] : undefined;
}

export async function inferDataType(
  index_type: string | null,
  slice_type: string | SliceTypeNull | undefined,
  selectedDatasetId: string | null
) {
  if (!index_type || !slice_type) {
    return null;
  }

  const ds = await fetchDatasetsByIndexType(index_type, selectedDatasetId);
  const dataTypes = new Set<string>();

  ds.forEach((dataset) => {
    if (dataset.slice_type === slice_type) {
      dataTypes.add(dataset.data_type);
    }
  });

  return dataTypes.size === 1 ? [...dataTypes][0] : null;
}

export async function inferTypesFromDatasetId(
  index_type: string | null,
  dataset_id: string
) {
  if (!index_type || !dataset_id) {
    return {
      inferredSliceType: undefined,
      inferredDataType: null,
    };
  }

  const ds = await fetchDatasetsByIndexType(index_type, dataset_id);
  const dataset = ds.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}"!`);
  }

  return {
    inferredSliceType: dataset.slice_type || SLICE_TYPE_NULL,
    inferredDataType: dataset.data_type,
  };
}

export async function inferDatasetId(
  index_type: string | null,
  slice_type: string | SliceTypeNull | null,
  dataType: string | null,
  selectedDatasetId: string | null
) {
  if (!index_type || !slice_type || !dataType) {
    return undefined;
  }

  const datasets = await fetchDatasetsByIndexType(
    index_type,
    selectedDatasetId
  );
  const ids = new Set<string>();

  datasets.forEach((dataset) => {
    if (dataset.slice_type === slice_type && dataset.data_type === dataType) {
      ids.add(dataset.id);
    }
  });

  return ids.size === 1 ? [...ids][0] : undefined;
}

export async function findDataType(
  index_type: string | null,
  dataset_id: string | null
) {
  const datasets = await fetchDatasetsByIndexType(
    index_type as string,
    dataset_id
  );
  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  return dataset?.data_type || null;
}
