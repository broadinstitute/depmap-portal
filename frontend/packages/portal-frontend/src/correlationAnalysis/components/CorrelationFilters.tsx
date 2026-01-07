import React from "react";
import Select from "react-select";
import styles from "../styles/CorrelationAnalysis.scss";
import { DRCDatasetOptions } from "@depmap/types";
import { sortDoseColorsByValue, formatDoseString } from "../utilities/helper";
import { GeneCorrelationDatasetOption } from "../types";

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
  compoundDatasetOptions: DRCDatasetOptions[];
  geneDatasetOptions: GeneCorrelationDatasetOption[];
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
  featureType: "gene" | "compound";
}

function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    selectedDatasetOption,
    compoundDatasetOptions,
    geneDatasetOptions,
    onChangeDataset,
    correlatedDatasets,
    onChangeCorrelatedDatasets,
    doses,
    selectedDoses,
    onChangeDoses,
    featureType,
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

  const compoundDatasetSelectOptions = compoundDatasetOptions.map(
    (compoundDataset: DRCDatasetOptions) => {
      return {
        value: compoundDataset.log_auc_dataset_given_id,
        label: compoundDataset.display_name,
      };
    }
  );

  const geneDatasetSelectOptions = geneDatasetOptions.map(
    (geneDataset: GeneCorrelationDatasetOption) => {
      return {
        value: geneDataset.datasetId,
        label: geneDataset.displayName,
      };
    }
  );

  const datasetSelectOptions =
    featureType === "compound"
      ? compoundDatasetSelectOptions
      : geneDatasetSelectOptions;

  return (
    <div className={styles.FiltersPanel}>
      <h4 className={styles.sectionTitle}>Dataset</h4>
      <Select
        placeholder="Select..."
        defaultValue={{
          label:
            featureType === "compound"
              ? compoundDatasetOptions[0].display_name
              : geneDatasetOptions[0].displayName,
          value:
            featureType === "compound"
              ? compoundDatasetOptions[0].log_auc_dataset_given_id
              : geneDatasetOptions[0].datasetId,
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
      {featureType === "compound" && (
        <>
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
        </>
      )}
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
