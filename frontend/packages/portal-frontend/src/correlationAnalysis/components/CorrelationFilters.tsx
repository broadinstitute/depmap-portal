import React, { useCallback } from "react";
import Select from "react-select";
import styles from "../styles/CorrelationFilters.scss";

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
  compoundName: string;
}

export default function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    datasets,
    onChangeDataset,
    correlatedDatasets,
    onChangeCorrelatedDatasets,
    doses,
    onChangeDoses,
    compoundName,
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
    <div className={styles.correlationFilters}>
      <div className={styles.filters}>
        <header>
          <b>Dataset ({compoundName})</b>
        </header>
        <Select
          className={styles.filterStyle}
          placeholder="Select..."
          value={datasetOptions[0]}
          options={datasetOptions}
          onChange={(value, action) => {
            console.log(value, action);
            onChangeDataset(value ? value.value : null);
          }}
        />
        <header
          style={{
            paddingTop: "20px",
            paddingBottom: "10px",
            borderTop: "1px solid darkgrey",
          }}
        >
          <b>FILTERS</b>
        </header>
        <header>
          <b>Dose</b>
        </header>
        <Select
          className={styles.filterStyle}
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
        />
        <header>
          <b>Correlated Dataset</b>
        </header>
        <Select
          className={styles.filterStyle}
          placeholder="Select..."
          defaultOptions
          options={correlatedDatasetOptions}
          isMulti
          onChange={(value, action) => {
            console.log(value, action);
            onChangeCorrelatedDatasets(
              value
                ? value.map(
                    (selectedCorrelatedDataset) =>
                      selectedCorrelatedDataset.value
                  )
                : []
            );
          }}
        />
      </div>
    </div>
  );
}
