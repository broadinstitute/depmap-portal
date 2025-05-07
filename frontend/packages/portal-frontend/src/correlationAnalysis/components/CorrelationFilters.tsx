import React, { useEffect, useState, useCallback } from "react";
import Select, { ActionMeta, OptionsType } from "react-select";
import styles from "../styles/CorrelationFilters.scss";

export interface FilterOption {
  readonly label: string;
  readonly value: string;
  readonly isFixed?: boolean;
  isDisabled?: boolean;
}

interface CorrelationFiltersProps {
  getDatasets: () => Promise<any[]>;
  onChangeDataset: (dataset: string | null) => void; // undetermined for now
  getFeatureTypes: () => Promise<any[]>;
  onChangeFeatureTypes: (featureTypes: string[]) => void;
  doses: string[];
  onChangeDoses: (doses: string[]) => void;
}

export default function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    getDatasets,
    onChangeDataset,
    getFeatureTypes,
    onChangeFeatureTypes,
    doses,
    onChangeDoses,
  } = props;
  const [datasetOptions, setDatasetOptions] = useState<FilterOption[]>([]);
  const [featureTypeOptions, setFeatureTypeOptions] = useState<FilterOption[]>(
    []
  );
  const getDoseOptions = useCallback(() => {
    return doses.map((dose) => {
      return { label: dose, value: dose };
    });
  }, [doses]);

  useEffect(() => {
    (async () => {
      try {
        const datasets = await getDatasets();
        setDatasetOptions(
          datasets.map((dataset) => {
            return { label: dataset.label, value: dataset.label };
          })
        );
        const featureTypes = await getFeatureTypes();
        setFeatureTypeOptions(
          featureTypes.map((featureType) => {
            return { label: featureType.label, value: featureType.label };
          })
        );
      } catch (e) {
        console.log(e);
      }
    })();
  }, [getDatasets, getFeatureTypes]);

  return (
    <div className={styles.correlationFilters}>
      <header style={{ paddingBottom: "10px" }}>FILTERS</header>
      <div className={styles.filters}>
        <header>Dataset</header>
        <Select
          className={styles.filterStyle}
          placeholder="Choose Dataset"
          options={datasetOptions}
          onChange={(value, action) => {
            console.log(value, action);
            onChangeDataset(value ? value.value : null);
          }}
        />
        <header>Dose</header>
        <Select
          className={styles.filterStyle}
          placeholder="imatinib Doses(uM)"
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
        <header>Feature Types</header>
        <Select
          className={styles.filterStyle}
          placeholder="Select Feature Types"
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
