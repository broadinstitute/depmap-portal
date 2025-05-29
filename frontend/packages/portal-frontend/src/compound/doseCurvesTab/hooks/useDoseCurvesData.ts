import { useEffect, useState, useRef } from "react";
import { getDapi } from "src/common/utilities/context";
import { CompoundDataset } from "src/compound/components/DoseResponseTab";
import { CompoundDoseCurveData, DoseTableRow } from "../types";

function useDoseCurvesData(dataset: CompoundDataset | null) {
  const dapi = getDapi();

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);
  const [doseTable, setDoseTable] = useState<DoseTableRow[] | null>(null);

  const latestPromise = useRef<Promise<CompoundDoseCurveData> | null>(null);
  const latestTablePromise = useRef<Promise<any> | null>(null);

  useEffect(() => {
    (async () => {
      if (dataset) {
        setIsLoading(true);

        const promise = dapi.getCompoundDoseCurveData!(
          dataset.dataset,
          dataset.compound_label,
          dataset.dose_replicate_dataset
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

        const tablePromise = dapi.getDoseResponseTable!(
          dataset.dose_replicate_dataset,
          dataset.compound_xref_full
        );

        latestTablePromise.current = tablePromise;
        tablePromise
          .then((fetchedData) => {
            if (tablePromise === latestTablePromise.current) {
              const modelIds = Object.keys(fetchedData).sort();
              const formattedTableData: DoseTableRow[] = modelIds.map(
                (modelId) => {
                  return { ...fetchedData[modelId], modelId };
                }
              );

              setDoseTable(formattedTableData);
            }
          })
          .catch((e) => {
            if (tablePromise === latestPromise.current) {
              window.console.error(e);
              // setError(true);
              // setIsLoading(false);
            }
          })
          .finally(() => {
            if (tablePromise === latestTablePromise.current) {
              // setIsLoading(false);
            }
          });
      }
    })();
  }, [setDoseCurveData, setIsLoading, dataset, dapi, setDoseTable]);

  return { error, isLoading, doseCurveData, doseTable };
}

export default useDoseCurvesData;
