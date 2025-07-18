import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  convertDimensionToSliceQuery,
  DimensionSelectV2,
} from "@depmap/data-explorer-2";
import type {
  DataExplorerPlotConfigDimensionV2,
  MatrixDataset,
  SliceQuery,
} from "@depmap/types";

interface Props {
  defaultValue: any;
  index_type_name: string;
  onChange: any;
}

// TODO: move this into a utility somewhere
async function convertSliceQueryToDataExplorerDimension(
  sliceQuery: SliceQuery
) {
  const { dataset_id, identifier, identifier_type } = sliceQuery;

  if (!["feature_id", "sample_id"].includes(identifier_type)) {
    throw new Error(`Unsupported identifier_type "${identifier_type}"!`);
  }

  const datasets = await cached(breadboxAPI).getDatasets();
  const dataset = datasets.find(
    (d) => d.id === dataset_id || d.given_id === dataset_id
  ) as MatrixDataset;

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}"`);
  }

  let slice_type = "";
  let name = "";

  if (identifier_type === "feature_id") {
    slice_type = dataset.feature_type_name;
    const features = await cached(breadboxAPI).getMatrixDatasetFeatures(
      dataset_id
    );
    name = features.find((f) => f.id === identifier)?.label || "unknown";
  } else {
    slice_type = dataset.sample_type_name;
    const samples = await cached(breadboxAPI).getMatrixDatasetSamples(
      dataset_id
    );
    name = samples.find((f) => f.id === identifier)?.label || "unknown";
  }

  return {
    axis_type: "raw_slice" as const,
    aggregation: "first" as const,
    dataset_id,
    slice_type,
    context: {
      name,
      dimension_type: slice_type,
      expr: { "==": [{ var: "given_id" }, identifier] },
      vars: {},
    },
  };
}

function MatrixDataSelect({ defaultValue, index_type_name, onChange }: Props) {
  const [
    valueAsDimension,
    setValueAsDimension,
  ] = useState<DataExplorerPlotConfigDimensionV2 | null>(null);

  useEffect(() => {
    (async () => {
      if (defaultValue) {
        const dimension = await convertSliceQueryToDataExplorerDimension(
          defaultValue
        );

        setValueAsDimension(dimension);
      }
    })();
  }, [defaultValue]);

  if (defaultValue && !valueAsDimension) {
    return <div>Loading...</div>;
  }
  return (
    <DimensionSelectV2
      mode="entity-only"
      index_type={index_type_name}
      value={valueAsDimension}
      onChange={async (dimension) => {
        const sliceQuery = await convertDimensionToSliceQuery(dimension);
        onChange(sliceQuery);
      }}
    />
  );
}

export default MatrixDataSelect;
