import { ToggleSwitch } from "@depmap/common-components";
import React from "react";
import Select from "react-select";
import { DRCDatasetOptions } from "@depmap/types";
import styles from "../CompoundDoseViability.scss";
import { Rep1Color, Rep2Color, Rep3Color } from "../utils";

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
        value: compoundDataset.viability_dataset_given_id,
        label: compoundDataset.display_name,
      };
    }
  );

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
        id="compound-dose-curves-dataset-selection"
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
      <div className={styles.toggleRow} style={{ paddingTop: "10px" }}>
        <div className={styles.toggleLabel}>Replicates</div>
        <ToggleSwitch
          value={showReplicates}
          onChange={handleToggleShowReplicates}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>
      <div className={styles.legendBox}>
        <div className={styles.legendRow}>
          <div
            className={styles.legendSwatch}
            style={{ background: Rep1Color, border: `1px solid ${Rep1Color}` }}
          />
          <span className={styles.legendLabel}>x1</span>
        </div>
        <div className={styles.legendRow}>
          <div
            className={styles.legendSwatch}
            style={{ background: Rep2Color, border: `1px solid ${Rep2Color}` }}
          />
          <span className={styles.legendLabel}>x2</span>
        </div>
        <div className={styles.legendRow}>
          <div
            className={styles.legendSwatch}
            style={{ background: Rep3Color, border: `1px solid ${Rep3Color}` }}
          />
          <span className={styles.legendLabel}>x3</span>
        </div>
      </div>
      <hr className={styles.filtersPanelHr} />
    </div>
  );
}

export default FiltersPanel;
