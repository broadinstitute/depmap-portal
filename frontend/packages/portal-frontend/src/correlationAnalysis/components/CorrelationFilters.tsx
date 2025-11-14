import React, { useCallback } from "react";
import Select from "react-select";
import styles from "../styles/CorrelationAnalysis.scss";

export interface FilterOption {
  readonly label: string;
  readonly value: string;
  readonly isFixed?: boolean;
  isDisabled?: boolean;
}

interface CorrelationFiltersProps {
  datasets: any[];
  onChangeDataset: (dataset: string) => void; // undetermined for now
  correlatedDatasets: any[];
  onChangeCorrelatedDatasets: (correlatedDatasets: string[]) => void;
  doses: string[];
  onChangeDoses: (doses: string[]) => void;
}

export default function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    datasets,
    onChangeDataset,
    correlatedDatasets,
    onChangeCorrelatedDatasets,
    doses,
    onChangeDoses,
  } = props;

  const datasetOptions = datasets.map((dataset) => {
    return { label: dataset, value: dataset };
  });
  const correlatedDatasetOptions = correlatedDatasets.map((corrDataset) => {
    return { label: corrDataset, value: corrDataset };
  });

  const getDoseOptions = useCallback(() => {
    return doses.map((dose) => {
      return { label: dose, value: dose };
    });
  }, [doses]);

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <Select
        placeholder="Select..."
        value={datasetOptions[0]}
        options={datasetOptions}
        onChange={(value, action) => {
          console.log(value, action);
          onChangeDataset(value ? value.value : null);
        }}
        id="corr-analysis-dataset-selection"
      />
      <hr className={styles.filtersPanelHr} />
      <h4 className={styles.sectionTitle} style={{ paddingBottom: "4px" }}>
        Filters
      </h4>
      <h4>Dose</h4>
      <Select
        placeholder="Select..."
        defaultOptions
        options={getDoseOptions()}
        isMulti
        onChange={(value, action) => {
          console.log(value, action);
          onChangeDoses(
            value ? value.map((selectedDose) => selectedDose.value) : []
          );
        }}
        id="corr-analysis-filter-by-dose"
      />
      <h4>Correlated Dataset</h4>
      <Select
        placeholder="Select..."
        defaultOptions
        options={correlatedDatasetOptions}
        isMulti
        onChange={(value, action) => {
          console.log(value, action);
          onChangeCorrelatedDatasets(
            value
              ? value.map(
                  (selectedCorrelatedDataset) => selectedCorrelatedDataset.value
                )
              : []
          );
        }}
      />
    </div>
  );
}
