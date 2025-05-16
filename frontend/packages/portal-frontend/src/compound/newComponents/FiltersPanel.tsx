import React from "react";
import Select from "react-select";
import { CompoundDataset } from "../components/DoseResponseTab";

interface FiltersPanelProps {
  handleSelectDataset: (selection: { value: string; label: string }) => void;
  datasetOptions: CompoundDataset[];
  selectedDatasetOption: { value: string; label: string };
}

// const getAxisLabel = () => {
//   // Different between repurposing and OncRef?
// };

function FiltersPanel({
  handleSelectDataset,
  datasetOptions,
  selectedDatasetOption,
}: FiltersPanelProps) {
  const datasetSelectOptions = datasetOptions.map(
    (compoundDataset: CompoundDataset) => {
      return {
        value: compoundDataset.id,
        label: compoundDataset.auc_dataset_display_name,
      };
    }
  );

  return (
    <div>
      <Select
        defaultValue={datasetSelectOptions[0]}
        value={selectedDatasetOption}
        isDisabled={!datasetSelectOptions}
        options={datasetSelectOptions}
        onChange={(value: any) => {
          if (value) {
            handleSelectDataset(value);
          }
        }}
        id="compound-dose-curves-dataset-selection"
      />
    </div>
  );
}

export default FiltersPanel;
