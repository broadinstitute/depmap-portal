import React, { useEffect, useRef, useState } from "react";
import {
  CurveData,
  CurvePlotPoints,
  DoseCurveData,
} from "src/compound/components/DoseResponseCurve";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import { DoseResponseCurvePromise } from "src/dAPI";
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
  ) => Promise<DoseResponseCurvePromise>;
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

  const doseCurvesLatestPromise = useRef<Promise<DoseResponseCurvePromise> | null>(
    null
  );

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
  console.log(data);
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
          measurements={[
            ...new Set<CurvePlotPoints>(
              data.dose_curves
                .map((curve: CurveData) => curve?.points)
                .filter(Boolean)
                .reduce((prev: any, cur: any) => prev!.concat(cur!), [])
            ),
          ]}
          curves={data.dose_curves
            .map((curve: CurveData) => curve?.curve_params)
            .filter(Boolean)
            .reduce((prev: any, cur: any) => prev!.concat(cur!), [])}
        />
      )}
    </div>
  );
}

export default React.memo(DoseCurvesTile);
