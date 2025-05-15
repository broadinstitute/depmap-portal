import { ApiContext } from "@depmap/api";
import React, { useContext, useEffect, useState } from "react";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { CurveParams } from "../components/DoseResponseCurve";
import { CompoundDataset } from "../components/DoseResponseTab";
import styles from "../styles/DataExplorer2.scss";

interface DoseCurvesTabProps {
  datasetOptions: CompoundDataset;
  doseUnits: string;
}

export interface CompoundDoseCurveData {
  curve_params: CurveParams[];
  min_dose: number;
  max_dose: number;
}

function DoseCurvesTab({ datasetOptions, doseUnits }: DoseCurvesTabProps) {
  const { getApi } = useContext(ApiContext);

  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<CompoundDataset | null>(null);
  const [error, setError] = useState(false);

  // Get the data and options for the selected dataset
  useEffect(() => {
    (async () => {
      try {
        const plot = await getApi().getCompoundDoseCurveData(
          (datasetName = { selectedDataset })
        );
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  return (
    <>
      <main>
        <FiltersPanel />
        <DoseCurvesMainContent />
      </main>
    </>
  );
}

export default DoseCurvesTab;
