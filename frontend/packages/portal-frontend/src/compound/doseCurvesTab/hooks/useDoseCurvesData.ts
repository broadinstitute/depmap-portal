import { useEffect, useState, useRef } from "react";
import { CompoundDoseCurveData, DRCDatasetOptions } from "@depmap/types";
import { legacyPortalAPI } from "@depmap/api";

function useDoseCurvesData(
  dataset: DRCDatasetOptions | null,
  compoundId: string,
  doseColumnNames: string[]
) {
  const dapi = legacyPortalAPI;

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);

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

        // Get doseMin and doseMax from doseColumnNames, which was previously determined in useDoseTableData.
        // useDoseTableData is hared with the Heatmap component. We only need doseMin and doseMax for the dose curves
        // plot.
        const doseValues = Array.isArray(doseColumnNames)
          ? doseColumnNames
              .map((d) => parseFloat(d.split(" ")[0]))
              .filter((n) => !Number.isNaN(n))
          : [];

        setDoseMin(doseValues.length > 0 ? Math.min(...doseValues) : null);
        setDoseMax(doseValues.length > 0 ? Math.max(...doseValues) : null);
      }
    })();
  }, [
    setDoseCurveData,
    setIsLoading,
    dataset,
    dapi,
    compoundId,
    doseColumnNames,
  ]);

  return { error, isLoading, doseCurveData, doseMin, doseMax };
}

export default useDoseCurvesData;
