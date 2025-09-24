import { useEffect, useMemo, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import type { BreadboxApiResponse } from "@depmap/api";
import { DataExplorerPlotConfigDimension } from "@depmap/types";
import {
  convertDimensionToSliceQuery,
  isCompleteDimension,
} from "../../../utils/misc";

interface Props {
  dimension: DataExplorerPlotConfigDimension | null;
  hiddenDatasets: Set<string>;
  sortByAbsoluteValue: boolean;
  sortDirection: "desc" | "asc";
  sortColumn: "correlation" | "log10qvalue";
}

type DatasetLookup = Record<
  string,
  BreadboxApiResponse["fetchAssociations"]["associated_datasets"][number]
>;

function usePrecomputedAssocationData({
  dimension,
  hiddenDatasets,
  sortByAbsoluteValue,
  sortDirection,
  sortColumn,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [associatedDimensions, setAssociatedDimensions] = useState<
    BreadboxApiResponse["fetchAssociations"]["associated_dimensions"]
  >([]);
  const [associatedDatasets, setAssociatedDatasets] = useState<
    BreadboxApiResponse["fetchAssociations"]["associated_datasets"]
  >([]);
  const [datasetLookup, setDatasetLookup] = useState<DatasetLookup>({});
  const [datasetName, setDatasetName] = useState("");
  const [dimensionLabel, setDimensionLabel] = useState("");
  const [error, setError] = useState(false);

  // Prevents unncessary reloads
  const stringifedDimension = JSON.stringify(dimension);

  useEffect(() => {
    const parsed = JSON.parse(stringifedDimension);

    if (!isCompleteDimension(parsed)) {
      setError(true);
      return;
    }

    (async () => {
      setIsLoading(true);

      try {
        const sliceQuery = await convertDimensionToSliceQuery(parsed);

        if (!sliceQuery) {
          setIsLoading(false);
          setError(true);
          return;
        }

        const rawData = await cached(breadboxAPI).fetchAssociations(sliceQuery);
        const lookup: DatasetLookup = {};

        rawData.associated_datasets.forEach((datasetInfo) => {
          lookup[datasetInfo.dataset_id] = datasetInfo;
        });

        setAssociatedDimensions(rawData.associated_dimensions);
        setAssociatedDatasets(rawData.associated_datasets);
        setDatasetLookup(lookup);
        setDatasetName(rawData.dataset_name);
        setDimensionLabel(rawData.dimension_label);
        setError(false);
      } catch (e) {
        window.console.error(e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [stringifedDimension]);

  const sortedFilteredAssociatedDimensions = useMemo(() => {
    return associatedDimensions
      .filter((d) => !hiddenDatasets.has(d.other_dataset_id))
      .sort((a, b) => {
        let valueA = sortDirection === "desc" ? a[sortColumn] : b[sortColumn];
        let valueB = sortDirection === "desc" ? b[sortColumn] : a[sortColumn];

        if (sortByAbsoluteValue) {
          valueA = Math.abs(valueA);
          valueB = Math.abs(valueB);
        }

        return valueB - valueA;
      });
  }, [
    associatedDimensions,
    hiddenDatasets,
    sortByAbsoluteValue,
    sortColumn,
    sortDirection,
  ]);

  const csvFriendlyFormat = useMemo(() => {
    const csvData: Record<string, string[]> = {
      "Gene/Compound": [],
      Dataset: [],
      Correlation: [],
      "Log10 q-value": [],
    };

    associatedDimensions
      .sort((a, b) => {
        const valueA = Math.abs(a.correlation);
        const valueB = Math.abs(b.correlation);

        return valueB - valueA;
      })
      .forEach((d) => {
        csvData["Gene/Compound"].push(d.other_dimension_label);
        csvData.Dataset.push(datasetLookup[d.other_dataset_id]?.name);
        csvData.Correlation.push(d.correlation.toFixed(3));
        csvData["Log10 q-value"].push(d.log10qvalue.toFixed(3));
      });

    return csvData;
  }, [associatedDimensions, datasetLookup]);

  return {
    error,
    isLoading,
    associatedDimensions,
    csvFriendlyFormat,
    sortedFilteredAssociatedDimensions,
    associatedDatasets,
    datasetLookup,
    datasetName,
    dimensionLabel,
  };
}

export default usePrecomputedAssocationData;
