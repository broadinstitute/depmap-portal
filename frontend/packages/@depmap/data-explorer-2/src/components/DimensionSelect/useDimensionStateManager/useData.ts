import { useEffect, useMemo, useState } from "react";
import { DataExplorerContext } from "@depmap/types";
import {
  fetchContextLabels,
  fetchDatasetsByIndexType,
  fetchDimensionLabelsToDatasetsMapping,
} from "../../../api";
import { DatasetsByIndexType, DimensionLabelsToDatasetsMapping } from "./types";

interface Props {
  index_type: string | null;
  slice_type: string | undefined;
  axis_type: "raw_slice" | "aggregated_slice" | undefined;
  context: DataExplorerContext | undefined;
}

export const NULL_MAPPING: DimensionLabelsToDatasetsMapping = {
  aliases: [],
  dataset_ids: [],
  dataset_labels: [],
  data_types: {},
  units: {},
  dimension_labels: {},
};

export default function useDatasets({
  index_type,
  slice_type,
  axis_type,
  context,
}: Props) {
  const [
    datasetsByIndexType,
    setDatasetsByIndexType,
  ] = useState<DatasetsByIndexType | null>(null);

  const [
    sliceMap,
    setSliceMap,
  ] = useState<DimensionLabelsToDatasetsMapping | null>(
    slice_type ? null : NULL_MAPPING
  );

  const [contextLabels, setContextLabels] = useState<Set<string> | null>(
    new Set()
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDatasetsByIndexType();
        setDatasetsByIndexType(data);
      } catch (e) {
        window.console.error(e);
        throw new Error("DimensionSelect: Error fetching datasets");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setSliceMap(null);

      try {
        if (slice_type) {
          const mapping = await fetchDimensionLabelsToDatasetsMapping(
            slice_type
          );
          setSliceMap(mapping);
        } else {
          setSliceMap(NULL_MAPPING);
        }
      } catch (e) {
        window.console.error(e);
        throw new Error(
          "DimensionSelect: Error fetching slice-labels-to-datasets mapping"
        );
      }
    })();
  }, [slice_type]);

  useEffect(() => {
    setContextLabels(new Set());

    if (axis_type === "aggregated_slice" && context) {
      setContextLabels(null);

      fetchContextLabels(context).then((labels) => {
        setContextLabels(new Set(labels));
      });
    }
  }, [axis_type, context]);

  const datasets = useMemo(() => {
    return datasetsByIndexType && index_type
      ? datasetsByIndexType[index_type]
      : [];
  }, [datasetsByIndexType, index_type]);

  return {
    datasets,
    sliceMap,
    contextLabels,
    isLoading:
      datasetsByIndexType === null ||
      sliceMap === null ||
      contextLabels === null,
  };
}
