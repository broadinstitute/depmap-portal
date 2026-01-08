import React from "react";
import Select from "react-select";
import { GeneCorrelationDatasetOption } from "../../types";
import styles from "../../styles/CorrelationAnalysis.scss";
import { customFilterStyles } from "./types";

interface GeneFiltersProps {
  geneDatasetOptions: GeneCorrelationDatasetOption[];
  selectedDatasetOption: { value: string; label: string } | null;
  onChangeDataset: (selection: any) => void;
  correlatedDatasetOptions: { value: string; label: string }[];
  onCorrelatedDatasetsChange: (value: any) => void;
}

export function GeneFilters({
  geneDatasetOptions,
  selectedDatasetOption,
  onChangeDataset,
  correlatedDatasetOptions,
  onCorrelatedDatasetsChange,
}: GeneFiltersProps) {
  const options = geneDatasetOptions.map((d) => ({
    value: d.datasetId,
    label: d.displayName,
  }));

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <Select
        value={selectedDatasetOption}
        options={options}
        onChange={onChangeDataset}
      />
      <hr className={styles.filtersPanelHr} />
      <h4 className={styles.sectionTitle}>Filters</h4>
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
