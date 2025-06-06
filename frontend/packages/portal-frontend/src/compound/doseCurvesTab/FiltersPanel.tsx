import { ToggleSwitch } from "@depmap/common-components";
import React from "react";
import Select from "react-select";
import { DRCDatasetOptions } from "./types";

interface FiltersPanelProps {
  handleSelectDataset: (selection: { value: string; label: string }) => void;
  datasetOptions: DRCDatasetOptions[];
  selectedDatasetOption: { value: string; label: string };
  showReplicates: boolean;
  showUnselectedLines: boolean;
  handleToggleShowReplicates: (nextValue: boolean) => void;
  handleToggleShowUnselectedLines: (nextValue: boolean) => void;
}

function FiltersPanel({
  handleSelectDataset,
  datasetOptions,
  selectedDatasetOption,
  showReplicates,
  showUnselectedLines,
  handleToggleShowReplicates,
  handleToggleShowUnselectedLines,
}: FiltersPanelProps) {
  const datasetSelectOptions = datasetOptions.map(
    (compoundDataset: DRCDatasetOptions) => {
      return {
        value: compoundDataset.viability_dataset_id,
        label: compoundDataset.display_name,
      };
    }
  );

  return (
    <div>
      <h4>Dataset</h4>
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
      <hr
        style={{
          marginTop: "20px",
          borderTop: "1px solid rgba(0, 0, 0, 1",
        }}
      />
      <h4>View Options</h4>
      <div style={{ paddingTop: "5px", paddingBottom: "8px" }}>
        <div style={{ paddingRight: "10px", paddingBottom: "4px" }}>
          Unselected lines
        </div>
        <div>
          <ToggleSwitch
            value={showUnselectedLines}
            onChange={handleToggleShowUnselectedLines}
            options={[
              { label: "ON", value: true },
              { label: "OFF", value: false },
            ]}
          />
        </div>
      </div>
      <div style={{ paddingTop: "10px" }}>
        <div
          style={{
            paddingRight: "10px",
            paddingBottom: "4px",
          }}
        >
          Replicates
        </div>
        <div>
          <ToggleSwitch
            value={showReplicates}
            onChange={handleToggleShowReplicates}
            options={[
              { label: "ON", value: true },
              { label: "OFF", value: false },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default FiltersPanel;
