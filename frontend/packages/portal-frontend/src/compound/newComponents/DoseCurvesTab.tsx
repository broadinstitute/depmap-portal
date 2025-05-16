import React, { useCallback, useState } from "react";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { CurveParams } from "../components/DoseResponseCurve";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";

interface DoseCurvesTabProps {
  datasetOptions: CompoundDataset[];
  doseUnits: string;
}

export interface CompoundDoseCurveData {
  curve_params: CurveParams[];
  min_dose: number;
  max_dose: number;
}

function DoseCurvesTab({ datasetOptions, doseUnits }: DoseCurvesTabProps) {
  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<CompoundDataset | null>(null);
  const [error, setError] = useState(false);

  const handleSelectDataset = useCallback(
    (selection: CompoundDataset | null) => {
      if (selection) {
        setSelectedDataset(selection);
      }
    },
    []
  );

  // TODO: What to show/how to handle before anything is selected?
  // Auto select first option? Is nothing selected even an option?
  return (
    <>
      <main>
        <FiltersPanel
          handleSelectDataset={handleSelectDataset}
          datasetOptions={datasetOptions}
        />
        <DoseCurvesMainContent dataset={selectedDataset} />
      </main>
    </>
  );
}

export default DoseCurvesTab;
