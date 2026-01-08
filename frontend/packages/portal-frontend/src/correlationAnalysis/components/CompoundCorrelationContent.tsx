import React, { useMemo } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import PlotSpinner from "src/plot/components/PlotSpinner";
import {
  SortedCorrelations,
  VolcanoDataForCorrelatedDataset,
} from "../models/CorrelationPlot";
import { SelectOption } from "../types";
import { useCorrelationContext } from "../context/useCorrelationContext";
import CorrelationsTable from "./CorrelationsTable";
import CorrelationsPlots from "./CorrelationsPlots";
import styles from "../styles/CorrelationAnalysis.scss";
import { CorrelationFilters } from "./Filters/CorrelationFilters";

interface CompoundCorrelationContentProps {
  isLoading: boolean;
  hasError: boolean;
  correlatedDatasets: string[];
  filteredTableData: SortedCorrelations[];
  volcanoData: VolcanoDataForCorrelatedDataset;
  selectedRows: Set<string>;
  doseColors: { hex: string | undefined; dose: string }[];
  doses: string[];
  selectedDatasetOption: SelectOption;
  onChangeDataset: (selection: SelectOption | null) => void;
  featureName: string;
  compoundDatasetOptions: DRCDatasetOptions[];
}

export function CompoundCorrelationContent({
  isLoading,
  hasError,
  correlatedDatasets,
  filteredTableData,
  volcanoData,
  selectedRows,
  doseColors,
  doses,
  selectedDatasetOption,
  onChangeDataset,
  featureName,
  compoundDatasetOptions,
}: CompoundCorrelationContentProps) {
  const {
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    handleDosesChange,
    handleLabelSelection,
    handleTableSelectionUpdate,
    resetAllLabels,
  } = useCorrelationContext();

  const datasetsToShow = useMemo(
    () =>
      selectedCorrelatedDatasets.length > 0
        ? selectedCorrelatedDatasets
        : Object.keys(volcanoData),
    [selectedCorrelatedDatasets, volcanoData]
  );

  return (
    <div className={styles.tabGrid}>
      <div className={styles.tabFilters}>
        <CorrelationFilters
          featureType="compound"
          compoundDatasetOptions={compoundDatasetOptions}
          doses={doses}
          selectedDoses={selectedDoses}
          onChangeDoses={handleDosesChange}
          selectedDatasetOption={selectedDatasetOption}
          onChangeDataset={onChangeDataset}
          correlatedDatasets={correlatedDatasets}
        />
      </div>

      <div className={styles.tabMain}>
        <div className={styles.mainContentContainer}>
          <div className={styles.mainContentHeader}>
            <h3>Correlation Analysis</h3>
            <p>
              Univariate associations for sensitivity profiles (Dose-Response).
            </p>
          </div>
          <hr style={{ borderTop: "1px solid black", marginBottom: "40px" }} />

          <div className={styles.mainContentGrid}>
            <div className={styles.plotArea}>
              {isLoading && (
                <div className={styles.spinnerContainer}>
                  <PlotSpinner />
                </div>
              )}
              {hasError && (
                <div className={styles.errorMessage}>Error loading data.</div>
              )}{" "}
              {!isLoading && !hasError && (
                <CorrelationsPlots
                  correlatedDatasetsToShow={datasetsToShow}
                  dosesToFilter={selectedDoses}
                  doseColors={doseColors}
                  volcanoDataForCorrelatedDatasets={volcanoData}
                  correlatedDatasetSelectedLabels={allSelectedLabels}
                  forwardSelectedLabels={handleLabelSelection}
                  featureType="compound"
                />
              )}
            </div>
          </div>

          <div className={styles.tableSection}>
            <hr className={styles.mainContentHr} />
            <div className={styles.mainContentCellLines}>
              <h3>Associated Features</h3>
              {selectedRows.size > 0 && (
                <button
                  className={styles.linkButton}
                  type="button"
                  onClick={resetAllLabels}
                >
                  Unselect all
                </button>
              )}
            </div>
            <CorrelationsTable
              isLoading={isLoading}
              hasError={hasError}
              data={filteredTableData}
              featureName={featureName}
              featureType="compound"
              selectedRows={selectedRows}
              onChangeSelections={(s) =>
                handleTableSelectionUpdate(s, filteredTableData, selectedRows)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
