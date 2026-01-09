import React, { useMemo } from "react";
import Select from "react-select";
import styles from "../../styles/CorrelationAnalysis.scss";
import { customFilterStyles } from "./types";
import { DRCDatasetOptions } from "@depmap/types";
import {
  formatDoseString,
  sortDoseColorsByValue,
} from "src/correlationAnalysis/utilities/helper";
import { useCorrelationContext } from "src/correlationAnalysis/context/useCorrelationContext";

interface CompoundFiltersProps {
  compoundDatasetOptions: DRCDatasetOptions[];
  selectedDatasetOption: { value: string; label: string } | null;
  onChangeDataset: (selection: any) => void;
  correlatedDatasetOptions: { value: string; label: string }[];
  doses: string[];
}

export function CompoundFilters({
  compoundDatasetOptions,
  selectedDatasetOption,
  onChangeDataset,
  correlatedDatasetOptions,
  doses,
}: CompoundFiltersProps) {
  const {
    handleCorrelatedDatasetsChange,
    handleDosesChange,
    selectedDoses,
  } = useCorrelationContext();

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

  const filteredCorrelatedDatasetOptions = correlatedDatasetOptions.filter(
    (opt) => opt.value !== selectedDatasetOption?.value
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
        onChange={handleDosesChange}
      />
      <h4>Correlated Dataset</h4>
      <Select
        isMulti
        options={filteredCorrelatedDatasetOptions}
        onChange={handleCorrelatedDatasetsChange}
        styles={customFilterStyles}
      />
    </div>
  );
}
