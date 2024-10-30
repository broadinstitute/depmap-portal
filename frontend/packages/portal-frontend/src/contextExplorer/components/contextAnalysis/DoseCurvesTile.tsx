import React, { useEffect, useRef, useState } from "react";
import { DoseCurveData } from "src/compound/components/DoseResponseCurve";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import DoseCurvesPlot from "./DoseCurvesPlot";

interface DoseCurvesTileProps {
  selectedDrugLabel: string | null;
  selectedContextName: string;
  datasetName: string;
  getContextExplorerDoseResponsePoints: (
    datasetName: string,
    selectedContextName: string,
    compoundLabel: string
  ) => Promise<DoseCurveData>;
}

function DoseCurvesTile(props: DoseCurvesTileProps) {
  const {
    selectedDrugLabel,
    selectedContextName,
    datasetName,
    getContextExplorerDoseResponsePoints,
  } = props;

  const [data, setData] = useState<DoseCurveData | null>();
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const doseCurvesLatestPromise = useRef<Promise<DoseCurveData> | null>(null);

  useEffect(() => {
    if (selectedDrugLabel) {
      setData(null);
      setPlotElement(null);
      setIsLoading(true);
      const doseCurvesPromise = getContextExplorerDoseResponsePoints(
        datasetName,
        selectedContextName,
        selectedDrugLabel
      );

      doseCurvesLatestPromise.current = doseCurvesPromise;

      doseCurvesPromise
        .then((dataVals: any) => {
          if (doseCurvesPromise === doseCurvesLatestPromise.current) {
            setData(dataVals);
          }
        })
        .catch((e) => {
          if (doseCurvesPromise === doseCurvesLatestPromise.current) {
            window.console.error(e);
            setIsError(true);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [datasetName, selectedContextName, selectedDrugLabel]);

  return (
    <div>
      {isError && (
        <div className={styles.initialLoadError}>
          <h1>Sorry, an error occurred</h1>
          <p>There was an error loading dose curves.</p>{" "}
        </div>
      )}
      {!isError && isLoading && <PlotSpinner />}
      {data && (
        <DoseCurvesPlot
          minDose={data.min_dose}
          maxDose={data.max_dose}
          inGroupCurveParams={data.in_group_curve_params}
          outGroupCurveParams={data.out_group_curve_params}
        />
      )}
    </div>
  );
}

export default React.memo(DoseCurvesTile);
