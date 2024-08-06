import { useEffect, useMemo, useState } from "react";
import { DataExplorerContext } from "@depmap/types";
import {
  fetchContextLabels,
  fetchDatasetsByIndexType,
  fetchEntityToDatasetsMapping,
} from "../../../api";
import { DatasetsByIndexType, EntityToDatasetsMapping } from "./types";

interface Props {
  index_type: string | null;
  entity_type: string | undefined;
  axis_type: "entity" | "context" | undefined;
  context: DataExplorerContext | undefined;
}

export const NULL_MAPPING: EntityToDatasetsMapping = {
  aliases: [],
  dataset_ids: [],
  dataset_labels: [],
  data_types: {},
  units: {},
  entity_labels: {},
};

export default function useDatasets({
  index_type,
  entity_type,
  axis_type,
  context,
}: Props) {
  const [
    datasetsByIndexType,
    setDatasetsByIndexType,
  ] = useState<DatasetsByIndexType | null>(null);

  const [
    entityMap,
    setEntityToDatasetsMapping,
  ] = useState<EntityToDatasetsMapping | null>(
    entity_type ? null : NULL_MAPPING
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
      setEntityToDatasetsMapping(null);

      try {
        if (entity_type) {
          const mapping = await fetchEntityToDatasetsMapping(entity_type);
          setEntityToDatasetsMapping(mapping);
        } else {
          setEntityToDatasetsMapping(NULL_MAPPING);
        }
      } catch (e) {
        window.console.error(e);
        throw new Error(
          "DimensionSelect: Error fetching entity/datasets mapping"
        );
      }
    })();
  }, [entity_type]);

  useEffect(() => {
    setContextLabels(new Set());

    if (axis_type === "context" && context) {
      setContextLabels(null);

      fetchContextLabels(context).then((result) => {
        setContextLabels(new Set(result.labels));
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
    entityMap,
    contextLabels,
    isLoading:
      datasetsByIndexType === null ||
      entityMap === null ||
      contextLabels === null,
  };
}
