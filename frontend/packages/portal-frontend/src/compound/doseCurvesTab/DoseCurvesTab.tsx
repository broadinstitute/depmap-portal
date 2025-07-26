import React, { useCallback, useState } from "react";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../CompoundDoseViability.scss";
import { DoseViabilityDataProvider } from "../hooks/DoseViabilityDataContext";
import useDoseCurvesSelectionHandlers from "./hooks/useDoseCurvesSelectionHandlers";

interface DoseCurvesTabProps {
  datasetOptions: DRCDatasetOptions[];
  doseUnits: string;
  compoundName: string;
  compoundId: string;
}

function DoseCurvesTab({
  datasetOptions,
  doseUnits,
  compoundName,
  compoundId,
}: DoseCurvesTabProps) {
  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<DRCDatasetOptions | null>(null);
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [showReplicates, setShowReplicates] = useState<boolean>(true);
  const [showUnselectedLines, setShowUnselectedLines] = useState<boolean>(true);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
  );

  const api = useDeprecatedDataExplorerApi();

  const {
    handleClickCurve,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  } = useDoseCurvesSelectionHandlers(
    selectedModelIds,
    selectedTableRows,
    setSelectedModelIds,
    setSelectedTableRows,
    api,
    setShowUnselectedLines
  );

  const handleSelectDataset = useCallback(
    (selection: { value: string; label: string } | null) => {
      if (selection) {
        setSelectedDatasetOption(selection);
        const selectedCompoundDataset = datasetOptions.find(
          (option: DRCDatasetOptions) =>
            option.viability_dataset_given_id === selection.value
        );
        if (selectedCompoundDataset) {
          setSelectedDataset(selectedCompoundDataset);
          setShowReplicates(true);
          setShowUnselectedLines(true);
          setSelectedModelIds(new Set([]));
          setSelectedTableRows(new Set([]));
        }
      }
    },
    [datasetOptions]
  );

  return (
    <DoseViabilityDataProvider
      dataset={selectedDataset}
      compoundId={compoundId}
    >
      <div className={styles.doseCurvesTabGrid}>
        <div className={styles.doseCurvesTabFilters}>
          <FiltersPanel
            handleSelectDataset={handleSelectDataset}
            datasetOptions={datasetOptions}
            selectedDatasetOption={
              selectedDatasetOption || {
                value: datasetOptions[0].viability_dataset_given_id,
                label: datasetOptions[0].display_name,
              }
            }
            showReplicates={showReplicates}
            showUnselectedLines={showUnselectedLines}
            handleToggleShowReplicates={(nextValue: boolean) =>
              setShowReplicates(nextValue)
            }
            handleToggleShowUnselectedLines={(nextValue: boolean) =>
              setShowUnselectedLines(nextValue)
            }
          />
        </div>
        <div className={styles.doseCurvesTabMain}>
          <DoseCurvesMainContent
            selectedModelIds={selectedModelIds}
            selectedTableRows={selectedTableRows}
            doseUnits={doseUnits}
            showReplicates={showReplicates}
            showUnselectedLines={showUnselectedLines}
            compoundName={compoundName}
            handleClickCurve={handleClickCurve}
            handleChangeTableSelection={handleChangeTableSelection}
            handleClickSaveSelectionAsContext={
              handleClickSaveSelectionAsContext
            }
            handleSetSelectionFromContext={handleSetSelectionFromContext}
            handleClearSelection={handleClearSelection}
          />
        </div>
      </div>
    </DoseViabilityDataProvider>
  );
}

export default DoseCurvesTab;
