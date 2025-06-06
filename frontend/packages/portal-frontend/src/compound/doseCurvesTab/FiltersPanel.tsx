import { ToggleSwitch } from "@depmap/common-components";
import React from "react";
import Select from "react-select";
import { DRCDatasetOptions, Rep1Color, Rep2Color, Rep3Color } from "./types";

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
      <h4 style={{ fontSize: "16px" }}>Dataset</h4>
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
      <h4 style={{ fontSize: "16px" }}>View Options</h4>
      <div
        style={{
          paddingTop: "8px",
          paddingBottom: "8px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            paddingRight: "10px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#3D4864",
            minWidth: "120px",
            textAlign: "left",
          }}
        >
          Unselected lines
        </div>
        <ToggleSwitch
          value={showUnselectedLines}
          onChange={handleToggleShowUnselectedLines}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>
      <div
        style={{ paddingTop: "10px", display: "flex", alignItems: "center" }}
      >
        <div
          style={{
            paddingRight: "10px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#3D4864",
            minWidth: "120px",
            textAlign: "left",
          }}
        >
          Replicates
        </div>
        <ToggleSwitch
          value={showReplicates}
          onChange={handleToggleShowReplicates}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "14px",
          marginTop: "20px",
          minWidth: "120px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              background: Rep1Color,
              border: `1px solid ${Rep1Color}`,
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>x1</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              background: Rep2Color,
              border: `1px solid ${Rep2Color}`,
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>x2</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              background: Rep3Color,
              border: `1px solid ${Rep3Color}`,
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>x3</span>
        </div>
      </div>
      <hr
        style={{
          marginTop: "20px",
          borderTop: "1px solid rgba(0, 0, 0, 1",
        }}
      />
    </div>
  );
}

export default FiltersPanel;
