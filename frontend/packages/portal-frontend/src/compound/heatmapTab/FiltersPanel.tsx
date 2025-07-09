import { ToggleSwitch } from "@depmap/common-components";
import React from "react";
import Select from "react-select";
import { DRCDatasetOptions } from "@depmap/types";
import { useDoseTableDataContext } from "../hooks/useDoseTableDataContext";
import styles from "../CompoundDoseViability.scss";

interface FiltersPanelProps {
  // Dataset Selection Props
  handleSelectDataset: (
    selection: { value: string; label: string } | null
  ) => void;
  datasetOptions: any[];
  selectedDatasetOption: { value: string; label: string } | null;
  // Filter by Dose Props
  handleFilterByDose: (
    selections: Array<{ value: number; label: string }> | null
  ) => void;
  // Toggle Switches
  showUnselectedLines: boolean;
  handleToggleShowUnselectedLines: (nextValue: boolean) => void;
  // NOTE: Temporarily disabling Insensitive Lines toggles until stakeholders
  // decide on a definition for "Insensitive"
  // showInsensitiveLines: boolean;
  // handleToggleShowInsensitiveLines: (nextValue: boolean) => void;
}

function FiltersPanel({
  // Dataset
  handleSelectDataset,
  datasetOptions,
  selectedDatasetOption,
  // Dose
  handleFilterByDose,
  // Toggle Switches
  // showInsensitiveLines,
  showUnselectedLines,
  // handleToggleShowInsensitiveLines,
  handleToggleShowUnselectedLines,
}: FiltersPanelProps) {
  const { doseColumnNames } = useDoseTableDataContext();

  const datasetSelectOptions = datasetOptions.map(
    (compoundDataset: DRCDatasetOptions) => {
      return {
        value: compoundDataset.viability_dataset_id,
        label: compoundDataset.display_name,
      };
    }
  );

  const doseSelectOptions = Array.from(doseColumnNames).map((dose) => ({
    value: parseFloat(dose.split(" ")[0]),
    label: dose,
  }));

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
      <h4 className={styles.sectionTitle} style={{ paddingBottom: "4px" }}>
        Filter by Dose
      </h4>
      <Select
        options={doseSelectOptions}
        isMulti
        isDisabled={!doseColumnNames}
        onChange={(values: any) => {
          handleFilterByDose(values as Array<{ value: number; label: string }>);
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
    </div>
  );
}

export default FiltersPanel;
