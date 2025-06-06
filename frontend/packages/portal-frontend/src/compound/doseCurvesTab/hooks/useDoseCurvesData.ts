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

  const latestPromise = useRef<Promise<CompoundDoseCurveData> | null>(null);

  useEffect(() => {
    (async () => {
      if (dataset) {
        setIsLoading(true);

        const promise = dapi.getCompoundDoseCurveData!(
          compoundId,
          dataset.drc_dataset_label
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

        const aucs = await dapi.getDoseCurveTableMetadata(
          dataset.auc_dataset_id,
          compoundId,
          dataset.drc_dataset_label,
          dataset.ic50_dataset_id || undefined
        );

        // Inverse log2 transform each value of feature.values before merging
        const allIndices = new Set<string>();
        compoundDoseFeatures.forEach((feature: any) => {
          if (feature.values) {
            Object.keys(feature.values).forEach((modelId) =>
              allIndices.add(modelId)
            );
          }
        });
        Object.keys(aucs).forEach((modelId) => allIndices.add(modelId));

        const mergedRows: any[] = [];
        allIndices.forEach((modelId) => {
          const row: any = { modelId: modelId };
          compoundDoseFeatures.forEach((feature: any) => {
            // Remove the compoundId substring from feature_id for the column name
            const col = feature.feature_id.replace(compoundId, "").trim();

            let value = feature.values ? feature.values[modelId] : undefined;

            if (!Number.isNaN(value)) {
              value = 2 ** value;
            }
            row[col] = value;
          });
          row.AUC = aucs[modelId];
          mergedRows.push(row);
        });

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

  return { error, isLoading, doseCurveData, doseTable };
}

export default useDoseCurvesData;
