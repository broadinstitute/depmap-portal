import React, { useEffect, useRef, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import { CompoundDoseCurveData } from "./types";

interface DoseCurvesMainContentProps {
  dataset: CompoundDataset | null;
  doseUnits: string;
}

function DoseCurvesMainContent({
  dataset,
  doseUnits,
}: DoseCurvesMainContentProps) {
  const dapi = getDapi();

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);

  const latestPromise = useRef<Promise<CompoundDoseCurveData> | null>(null);

  // Get the data and options for the selected dataset
  useEffect(() => {
    (async () => {
      if (dataset) {
        setIsLoading(true);
        const promise = dapi.getCompoundDoseCurveData!(
          dataset.id,
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
      }
    })();
  }, [setDoseCurveData, setIsLoading, dataset, dapi]);

  console.log(isLoading);
  console.log(error);

  return (
    <div>
      <DoseCurvesPlotSection curvesData={doseCurveData} doseUnits={doseUnits} />
    </div>
  );
}

export default DoseCurvesMainContent;
