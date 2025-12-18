import React from "react";
import Select from "react-select";
import styles from "../styles/CorrelationAnalysis.scss";
import { DRCDatasetOptions } from "@depmap/types";
import { sortDoseColorsByValue, formatDoseString } from "../utilities/helper";

const customStyles = {
  multiValue: (s: any) => ({
    ...s,
    maxWidth: "100%",
    flex: "1 1 auto",
    margin: "2px 4px",
    backgroundColor: "#eef2ff",
  }),

  multiValueLabel: (s: any) => ({
    ...s,
    whiteSpace: "normal",
    wordBreak: "break-word",
    padding: "2px 8px",
    fontSize: "1.1rem",
    lineHeight: "1.25",
  }),

  valueContainer: (s: any) => ({
    ...s,
    flexWrap: "wrap",
  }),
};

export interface FilterOption {
  readonly label: string;
  readonly value: string;
  readonly isFixed?: boolean;
  isDisabled?: boolean;
}

interface CorrelationFiltersProps {
  selectedDatasetOption: { value: string; label: string } | null;
  datasetOptions: DRCDatasetOptions[];
  onChangeDataset: (
    selection: {
      value: string;
      label: string;
    } | null
  ) => void;
  correlatedDatasets: any[];
  onChangeCorrelatedDatasets: (correlatedDatasets: string[]) => void;
  doses: string[];
  selectedDoses: string[];
  onChangeDoses: (doses: string[]) => void;
}

function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    selectedDatasetOption,
    datasetOptions,
    onChangeDataset,
    correlatedDatasets,
    onChangeCorrelatedDatasets,
    doses,
    selectedDoses,
    onChangeDoses,
  } = props;

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

  const correlatedDatasetOptions = React.useMemo(
    () =>
      correlatedDatasets.map((corrDataset) => ({
        label: corrDataset,
        value: corrDataset,
      })),
    [correlatedDatasets]
  );

  const doseOptions = React.useMemo(() => {
    const sortedDoses = sortDoseColorsByValue(
      doses.map((doseValue: string) => {
        return { hex: undefined, dose: doseValue };
      })
    );

    return sortedDoses.map((doseAndColor) => {
      const doseStr = formatDoseString(doseAndColor.dose);
      return {
        label: doseStr,
        value: doseAndColor.dose,
      };
    });
  }, [doses]);

  const formattedSelectedDoses = React.useMemo(
    () =>
      selectedDoses.map((dose) => ({
        label: formatDoseString(dose),
        value: dose,
      })),
    [selectedDoses]
  );

  const datasetSelectOptions = datasetOptions.map(
    (compoundDataset: DRCDatasetOptions) => {
      return {
        value: compoundDataset.log_auc_dataset_given_id,
        label: compoundDataset.display_name,
      };
    }
  );

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <Select
        placeholder="Select..."
        defaultValue={{
          label: datasetOptions[0].display_name,
          value: datasetOptions[0].log_auc_dataset_given_id,
        }}
        value={selectedDatasetOption}
        options={datasetSelectOptions}
        onChange={(value: any) => {
          if (value) {
            onChangeDataset(value);
          }
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
        options={doseOptions}
        value={formattedSelectedDoses || []}
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
        styles={customStyles}
      />
    </div>
  );
}

export default React.memo(CorrelationFilters);
