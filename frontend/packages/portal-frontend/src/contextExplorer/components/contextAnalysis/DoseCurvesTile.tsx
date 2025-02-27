import React, { useEffect, useRef, useState } from "react";
import { DoseCurveData } from "src/compound/components/DoseResponseCurve";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import DoseCurvesPlot from "./DoseCurvesPlot";

interface DoseCurvesTileProps {
  selectedDrugLabel: string | null;
  selectedContextName: string;
  subtypeCode: string;
  selectedLevel: number;
  selectedOutGroupType: string;
  datasetName: string;
  getContextExplorerDoseResponsePoints: (
    datasetName: string,
    outGroupType: string,
    subtypeCode: string,
    compoundLabel: string,
    selectedLevel: number
  ) => Promise<DoseCurveData>;
}

function DoseCurvesTile(props: DoseCurvesTileProps) {
  const {
    selectedDrugLabel,
    subtypeCode,
    selectedContextName,
    selectedLevel,
    selectedOutGroupType,
    datasetName,
    getContextExplorerDoseResponsePoints,
  } = props;

  const [data, setData] = useState<DoseCurveData | null>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const doseCurvesLatestPromise = useRef<Promise<DoseCurveData> | null>(null);

  useEffect(() => {
    if (selectedDrugLabel) {
      setData(null);
      setIsLoading(true);
      const doseCurvesPromise = getContextExplorerDoseResponsePoints(
        datasetName,
        selectedOutGroupType,
        subtypeCode,
        selectedDrugLabel,
        selectedLevel
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
  }, [
    datasetName,
    subtypeCode,
    selectedDrugLabel,
    selectedLevel,
    selectedOutGroupType,
    getContextExplorerDoseResponsePoints,
  ]);

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
        <div className={styles.doseCurvesTile}>
          <DoseCurvesPlot
            minDose={data.min_dose}
            maxDose={data.max_dose}
            inGroupCurveParams={data.in_group_curve_params}
            outGroupCurveParams={data.out_group_curve_params}
          />
          <fieldset className={styles.doseCurvesLegend}>
            <div className={styles.modelsBox} />
            <div className={styles.doseCurvesLegendLabel}>
              {selectedDrugLabel?.split(" ")[0]} {selectedContextName} Models
            </div>
            <div className={styles.medianInGroupBox} />
            <div className={styles.doseCurvesLegendLabel}>
              Median of {selectedDrugLabel?.split(" ")[0]} {selectedContextName}
            </div>
            <div className={styles.medianOutGroupBox} />
            <div className={styles.doseCurvesLegendLabel}>
              Median of {selectedOutGroupType}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

export default React.memo(DoseCurvesTile);
