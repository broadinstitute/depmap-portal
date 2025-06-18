import { ToggleSwitch } from "@depmap/common-components";
import React from "react";
import Select from "react-select";
import { DRCDatasetOptions } from "@depmap/types";
import styles from "./CompoundDoseCurves.scss";

interface FiltersPanelProps {
  // Dataset Selection Props
  handleSelectDataset: (selection: { value: string; label: string }) => void;
  datasetOptions: DRCDatasetOptions[];
  selectedDatasetOption: { value: string; label: string };
  // Filter by Dose Props
  handleFilterByDose: (selection: { value: string; label: string }) => void;
  doseOptions: Set<string>;
  selectedDoseOption: { value: string; label: string }[];
  // Toggle Switches
  showInsensitiveLines: boolean;
  showUnselectedLines: boolean;
  handleToggleShowInsensitiveLines: (nextValue: boolean) => void;
  handleToggleShowUnselectedLines: (nextValue: boolean) => void;
}

function FiltersPanel({
  // Dataset
  handleSelectDataset,
  datasetOptions,
  selectedDatasetOption,
  // Dose
  handleFilterByDose,
  doseOptions,
  selectedDoseOption,
  // Toggle Switches
  showInsensitiveLines,
  showUnselectedLines,
  handleToggleShowInsensitiveLines,
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

  // TODO: Implement logic for constructing doseSelectOptions
  const doseSelectOptions: any[] = [];

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <h6>More dataset options coming soon!</h6>
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
        id="compound-heatmap-dataset-selection"
      />
      <hr className={styles.filtersPanelHr} />
      <h5 className={styles.filterByDoseLabel}>Filter by Dose</h5>
      <Select
        value={selectedDoseOption}
        isMulti
        isDisabled={!doseOptions}
        options={doseSelectOptions}
        onChange={(values: any) => {
          if (values) {
            values.forEach((value: any) => handleFilterByDose(value));
          }
        }}
        id="compound-heatmap-filter-by-dose"
      />
      <hr className={styles.filtersPanelHr} />
      <h4 className={styles.sectionTitle}>View Options</h4>
      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>Unselected lines</div>
        <ToggleSwitch
          value={showUnselectedLines}
          onChange={handleToggleShowUnselectedLines}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>
      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>Insensitive lines</div>
        <ToggleSwitch
          value={showInsensitiveLines}
          onChange={handleToggleShowInsensitiveLines}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>

      <hr className={styles.filtersPanelHr} />
    </div>
  );
}

export default FiltersPanel;
