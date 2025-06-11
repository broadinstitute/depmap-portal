import { useEffect, useState, useRef } from "react";
import { getBreadboxApi, getDapi } from "src/common/utilities/context";
import {
  CompoundDoseCurveData,
  DoseTableRow,
  DRCDatasetOptions,
} from "../types";

function useDoseCurvesData(
  dataset: DRCDatasetOptions | null,
  compoundId: string
) {
  const dapi = getDapi();
  const bbapi = getBreadboxApi();

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);
  const [doseTable, setDoseTable] = useState<DoseTableRow[] | null>(null);
  const [doseMin, setDoseMin] = useState<number | null>(null);
  const [doseMax, setDoseMax] = useState<number | null>(null);

  const latestPromise = useRef<Promise<CompoundDoseCurveData> | null>(null);

  useEffect(() => {
    (async () => {
      if (dataset) {
        setIsLoading(true);

        const promise = dapi.getCompoundDoseCurveData!(
          compoundId,
          dataset.drc_dataset_label,
          dataset.replicate_dataset
        );

        latestPromise.current = promise;
        promise
          .then((fetchedData) => {
            if (promise === latestPromise.current) {
              setDoseCurveData(fetchedData);
            }
          })
          .catch((e) => {
            if (promise === latestPromise.current) {
              window.console.error(e);
              setError(true);
              setIsLoading(false);
            }
          })
          .finally(() => {
            if (promise === latestPromise.current) {
              setIsLoading(false);
            }
          });

        const featuresData = (
          await bbapi.getDatasetFeatures(dataset.viability_dataset_id)
        ).filter((feature) => feature.id.includes(compoundId));

        const compoundDoseFeatures = await bbapi.getFeaturesData(
          dataset.viability_dataset_id,
          featuresData.map((doseFeat) => doseFeat.id)
        );

        const aucsList = await bbapi.getFeaturesData(dataset.auc_dataset_id, [
          compoundId,
        ]);

        // aucsList is a list of length equal to the number of features we asked for.
        // We are only looking at 1 compound at a time, so aucs will always be length 1.
        const aucs = aucsList[0];

        // Inverse log2 transform each value of feature.values before merging
        // Build a map of modelId to row for fast merging
        const allIndices = new Set<string>();
        const doseColNames: string[] = [];
        const doseValues: number[] = [];
        const featureValueMaps: Record<string, Record<string, number>> = {};
        compoundDoseFeatures.forEach((feature: any) => {
          if (feature.values) {
            Object.keys(feature.values).forEach((modelId) =>
              allIndices.add(modelId)
            );
          }
          // Remove the compoundId substring from feature_id for the column name
          const col = feature.feature_id.replace(compoundId, "").trim();
          doseColNames.push(col);
          featureValueMaps[col] = feature.values || {};

          // Keep track of all dose values so we can set the minimum and maximum of the plot's
          // x-axis accordingly.
          const floatMatch = col.match(/^([+-]?([0-9]*[.])?[0-9]+)/);
          const doseValue = floatMatch ? parseFloat(floatMatch[1]) : null;
          if (doseValue) {
            doseValues.push(doseValue);
          }
        });
        Object.keys(aucs).forEach((modelId) => allIndices.add(modelId));

        // Precompute all dose values for each modelId and col
        const mergedRows: any[] = [];
        allIndices.forEach((modelId) => {
          const row: any = { modelId };
          // Fill dose columns in the same order as doseColNames
          doseColNames.forEach((col) => {
            let value = featureValueMaps[col][modelId];
            if (!Number.isNaN(value)) {
              value = 2 ** value;
            }
            row[col] =
              value !== undefined && value !== null
                ? value.toFixed(3)
                : undefined;
          });
          // Only add row if at least one doseCol is not null/undefined
          const hasDose = doseColNames.some((col) => row[col] !== undefined);
          if (
            aucs.values[modelId] !== undefined &&
            aucs.values[modelId] !== null &&
            hasDose
          ) {
            row.AUC = aucs.values[modelId].toFixed(3);
            mergedRows.push(row);
          }
        });

        setDoseMin(Math.min(...doseValues));
        setDoseMax(Math.max(...doseValues));
        setDoseTable(mergedRows);
      }
    })();
  }, [
    setDoseCurveData,
    setIsLoading,
    dataset,
    dapi,
    bbapi,
    compoundId,
    setDoseTable,
  ]);

  return { error, isLoading, doseCurveData, doseTable, doseMin, doseMax };
}

export default useDoseCurvesData;
