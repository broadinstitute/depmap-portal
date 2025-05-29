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
  featureTypes: any[];
  onChangeFeatureTypes: (featureTypes: string[]) => void;
  doses: string[];
  onChangeDoses: (doses: string[]) => void;
  compoundName: string;
}

export default function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    datasets,
    onChangeDataset,
    featureTypes,
    onChangeFeatureTypes,
    doses,
    onChangeDoses,
    compoundName,
  } = props;

  const datasetOptions = datasets.map((dataset) => {
    return { label: dataset, value: dataset };
  });
  const featureTypeOptions = featureTypes.map((featureType) => {
    return { label: featureType, value: featureType };
  });
  console.log("FEATURE TYPES", featureTypeOptions);

  const getDoseOptions = useCallback(() => {
    return doses.map((dose) => {
      return { label: dose, value: dose };
    });
  }, [doses]);

  return (
    <div className={styles.correlationFilters}>
      <div className={styles.filters}>
        <header>Dataset ({compoundName})</header>
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
          style={{ paddingBottom: "10px", borderTop: "1px solid darkgrey" }}
        >
          FILTERS
        </header>
        <header>Dose</header>
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
        <header>Correlated Dataset</header>
        <Select
          className={styles.filterStyle}
          placeholder="Select..."
          defaultOptions
          options={featureTypeOptions}
          isMulti
          onChange={(value, action) => {
            console.log(value, action);
            onChangeFeatureTypes(
              value
                ? value.map((selectedFeatureType) => selectedFeatureType.value)
                : []
            );
          }}
        />
      </div>
    </div>
  );
}
