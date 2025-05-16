import { ApiContext } from "@depmap/api";
import React, { useContext, useEffect, useRef, useState } from "react";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import { CompoundDoseCurveData } from "./DoseCurvesTab";

interface DoseCurvesMainContentProps {
  dataset: CompoundDataset | null;
}

function DoseCurvesMainContent({ dataset }: DoseCurvesMainContentProps) {
  const { getApi } = useContext(ApiContext);

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
        const promise = getApi().getCompoundDoseCurveData(
          dataset.auc_dataset_display_name,
          dataset.compound_label
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
  }, [setDoseCurveData, setIsLoading, dataset]);

  return (
    <div>
      <DoseCurvesPlotSection curvesData={doseCurveData} />
    </div>
  );
}

export default DoseCurvesMainContent;
