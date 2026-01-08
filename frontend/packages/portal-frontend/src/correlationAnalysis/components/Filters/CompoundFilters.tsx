import React, { useMemo } from "react";
import Select from "react-select";
import styles from "../../styles/CorrelationAnalysis.scss";
import { customFilterStyles } from "./types";
import { DRCDatasetOptions } from "@depmap/types";
import {
  formatDoseString,
  sortDoseColorsByValue,
} from "src/correlationAnalysis/utilities/helper";

interface CompoundFiltersProps {
  compoundDatasetOptions: DRCDatasetOptions[];
  selectedDatasetOption: { value: string; label: string } | null;
  onChangeDataset: (selection: any) => void;
  correlatedDatasetOptions: { value: string; label: string }[];
  onCorrelatedDatasetsChange: (value: any) => void;
  doses: string[];
  selectedDoses: string[];
  onDosesChange: (value: any) => void;
}

export function CompoundFilters({
  compoundDatasetOptions,
  selectedDatasetOption,
  onChangeDataset,
  correlatedDatasetOptions,
  onCorrelatedDatasetsChange,
  doses,
  selectedDoses,
  onDosesChange,
}: CompoundFiltersProps) {
  const datasetOptions = compoundDatasetOptions.map((d) => ({
    value: d.log_auc_dataset_given_id,
    label: d.display_name,
  }));

  const doseOptions = useMemo(() => {
    const sorted = sortDoseColorsByValue(
      doses.map((d) => ({ hex: undefined, dose: d }))
    );
    return sorted.map((d) => ({
      label: formatDoseString(d.dose),
      value: d.dose,
    }));
  }, [doses]);

  const formattedSelectedDoses = useMemo(
    () => selectedDoses.map((d) => ({ label: formatDoseString(d), value: d })),
    [selectedDoses]
  );

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <Select
        value={selectedDatasetOption}
        options={datasetOptions}
        onChange={onChangeDataset}
      />
      <hr className={styles.filtersPanelHr} />
      <h4 className={styles.sectionTitle}>Filters</h4>
      <h4>Dose</h4>
      <Select
        isMulti
        options={doseOptions}
        value={formattedSelectedDoses}
        onChange={onDosesChange}
      />
      <h4>Correlated Dataset</h4>
      <Select
        isMulti
        options={correlatedDatasetOptions}
        onChange={onCorrelatedDatasetsChange}
        styles={customFilterStyles}
      />
    </div>
  );
}
