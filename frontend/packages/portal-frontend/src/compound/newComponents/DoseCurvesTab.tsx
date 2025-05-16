import React, { useCallback, useState } from "react";
import { useEffect } from "react";
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
          (option: CompoundDataset) => option.id === selection.value
        )[0];
        setSelectedDataset(selectedCompoundDataset);
      }
    },
    [datasetOptions]
  );

  console.log({ selectedDatasetOption });
  console.log(selectedDataset);

  return (
    <>
      <main>
        <FiltersPanel
          handleSelectDataset={handleSelectDataset}
          datasetOptions={datasetOptions}
          selectedDatasetOption={
            selectedDatasetOption || {
              value: datasetOptions[0].id,
              label: datasetOptions[0].auc_dataset_display_name,
            }
          }
        />
        <DoseCurvesMainContent
          dataset={selectedDataset}
          doseUnits={doseUnits}
        />
      </main>
    </>
  );
}

export default DoseCurvesTab;
