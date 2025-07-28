import { useEffect, useState } from "react";
import {
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
} from "@depmap/types";
import { isCompleteExpression } from "@depmap/data-explorer-2";
import { fetchDatasetsMatchingContextIncludingEntities } from "src/secretDataViewer/deprecated-api";

const compareCaseInsenstive = (a: string, b: string) => {
  return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
};

export function getDataType(
  datasets: DataExplorerDatasetDescriptor[],
  dataset_id: string
) {
  return datasets.find((d) => d.id === dataset_id || d.given_id === dataset_id)!
    .data_type;
}

export function getDataTypes(
  datasets: DataExplorerDatasetDescriptor[],
  featureType?: string | null
) {
  const out = new Set<string>();

  datasets
    .filter((d) => !featureType || d.slice_type === featureType)
    .forEach((d) => {
      out.add(d.data_type);
    });

  return [...out].sort(compareCaseInsenstive);
}

export function getFeatureType(
  datasets: DataExplorerDatasetDescriptor[],
  dataset_id: string
) {
  return datasets.find((d) => d.id === dataset_id || d.given_id === dataset_id)!
    .slice_type;
}

export function getFeatureTypes(
  datasets: DataExplorerDatasetDescriptor[],
  dataType?: string | null
) {
  const out = new Set<string>();

  datasets
    .filter((d) => !dataType || d.data_type === dataType)
    .forEach((d) => {
      out.add(d.slice_type);
    });

  return [...out].sort(compareCaseInsenstive);
}

export function filterDatasets(
  datasets: DataExplorerDatasetDescriptor[],
  filters: {
    dataType?: string | null;
    featureType?: string | null;
  }
) {
  const { dataType, featureType } = filters;

  return datasets
    .filter((d) => !dataType || d.data_type === dataType)
    .filter((d) => !featureType || d.slice_type === featureType);
}

export function groupBy(
  datasets: DataExplorerDatasetDescriptor[],
  property: "dataType" | "featureType"
) {
  const groups = new Map<string, DataExplorerDatasetDescriptor[]>();

  datasets.forEach((d) => {
    const prop = d[property === "dataType" ? "data_type" : "slice_type"];
    const group = groups.get(prop) || [];

    groups.set(prop, [...group, d]);
  });

  return [...groups.entries()].sort((a, b) => {
    return compareCaseInsenstive(a[0], b[0]);
  });
}

export const useContextFilteredDatasetIds = (
  context: Partial<DataExplorerContext> | null
) => {
  const [contextDatasetIds, setContextDatasetIds] = useState<null | string[]>(
    null
  );
  const [isEvaluatingContext, setIsEvaluatingContext] = useState(false);

  useEffect(() => {
    setContextDatasetIds(null);

    (async () => {
      if (context && isCompleteExpression(context.expr)) {
        try {
          setIsEvaluatingContext(true);

          const datasets = await fetchDatasetsMatchingContextIncludingEntities(
            context as DataExplorerContext
          );

          const ids = datasets.map((d) => d.dataset_id);

          setContextDatasetIds(ids);
        } catch (e) {
          window.console.error(e);
        } finally {
          setIsEvaluatingContext(false);
        }
      }
    })();
  }, [context]);

  return { contextDatasetIds, isEvaluatingContext };
};
