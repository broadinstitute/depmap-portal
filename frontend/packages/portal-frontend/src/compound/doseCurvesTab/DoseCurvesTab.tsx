import React, { useEffect, useCallback, useState } from "react";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";

interface DoseCurvesTabProps {
  datasetOptions: CompoundDataset[];
  doseUnits: string;
}

function DoseCurvesTab({ datasetOptions, doseUnits }: DoseCurvesTabProps) {
  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<CompoundDataset | null>(null);
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  // const [error, setError] = useState(false);

  useEffect(() => {
    if (datasetOptions) {
      setSelectedDataset(datasetOptions[0]);
    }
  }, [datasetOptions]);

  const handleSelectDataset = useCallback(
    (selection: { value: string; label: string } | null) => {
      if (selection) {
        setSelectedDatasetOption(selection);
        const selectedCompoundDataset = datasetOptions.filter(
          (option: CompoundDataset) => option.dataset === selection.value
        )[0];
        setSelectedDataset(selectedCompoundDataset);
      }
    },
    [datasetOptions]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 4fr",
        gridTemplateAreas: "'filters main main main main'",
        gap: "2rem",
      }}
    >
      <div style={{ gridArea: "filters" }}>
        <FiltersPanel
          handleSelectDataset={handleSelectDataset}
          datasetOptions={datasetOptions}
          selectedDatasetOption={
            selectedDatasetOption || {
              value: datasetOptions[0].dataset,
              label: datasetOptions[0].auc_dataset_display_name,
            }
          }
        />
      </div>
      <div style={{ gridArea: "main" }}>
        <DoseCurvesMainContent
          dataset={selectedDataset}
          doseUnits={doseUnits}
        />
      </div>
    </div>
  );
}

export default DoseCurvesTab;
