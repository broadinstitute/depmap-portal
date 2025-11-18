import React from "react";
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

function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    datasets,
    onChangeDataset,
    correlatedDatasets,
    onChangeCorrelatedDatasets,
    doses,
    onChangeDoses,
  } = props;

  const handleDatasetChange = React.useCallback(
    (value: any) => {
      // react-select provides the selected option or null
      onChangeDataset(value ? value.value : null);
    },
    [onChangeDataset]
  );

  const handleDosesChange = React.useCallback(
    (value: any) => {
      onChangeDoses(value ? value.map((selected: any) => selected.value) : []);
    },
    [onChangeDoses]
  );

  const handleCorrelatedDatasetsChange = React.useCallback(
    (value: any) => {
      onChangeCorrelatedDatasets(
        value ? value.map((selected: any) => selected.value) : []
      );
    },
    [onChangeCorrelatedDatasets]
  );

  const datasetOptions = React.useMemo(
    () => datasets.map((dataset) => ({ label: dataset, value: dataset })),
    [datasets]
  );

  const correlatedDatasetOptions = React.useMemo(
    () =>
      correlatedDatasets.map((corrDataset) => ({
        label: corrDataset,
        value: corrDataset,
      })),
    [correlatedDatasets]
  );

  const doseOptions = React.useMemo(
    () => doses.map((dose) => ({ label: dose, value: dose })),
    [doses]
  );

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <Select
        placeholder="Select..."
        value={datasetOptions[0]}
        options={datasetOptions}
        onChange={handleDatasetChange}
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
        options={doseOptions}
        isMulti
        onChange={handleDosesChange}
        id="corr-analysis-filter-by-dose"
      />
      <h4>Correlated Dataset</h4>
      <Select
        placeholder="Select..."
        defaultOptions
        options={correlatedDatasetOptions}
        isMulti
        onChange={handleCorrelatedDatasetsChange}
      />
    </div>
  );
}

export default React.memo(CorrelationFilters);
