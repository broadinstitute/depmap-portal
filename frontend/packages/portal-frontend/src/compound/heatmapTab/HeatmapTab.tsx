import React, { useCallback, useState } from "react";
import HeatmapTabMainContent from "./HeatmapTabMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../CompoundDoseViability.scss";
import { DoseViabilityDataProvider } from "../hooks/DoseViabilityDataContext";
import useHeatmapSelectionHandlers from "./hooks/useHeatmapSelectionHandlers";

interface HeatmapTabProps {
  datasetOptions: DRCDatasetOptions[];
  doseUnits: string;
  compoundName: string;
  compoundId: string;
}

function HeatmapTab({
  datasetOptions,
  doseUnits,
  compoundName,
  compoundId,
}: HeatmapTabProps) {
  const [selectedDataset, setSelectedDataset] = useState<DRCDatasetOptions>(
    datasetOptions[0]
  );
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  }>({
    value: datasetOptions[0].viability_dataset_given_id,
    label: datasetOptions[0].display_name,
  });

  const [showUnselectedLines, setShowUnselectedLines] = useState<boolean>(true);
  const [selectedDoses, setSelectedDoses] = useState<
    { value: number; label: string }[]
  >([]);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
  );

  const api = useDeprecatedDataExplorerApi();

  const {
    handleSetSelectedPlotModels,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  } = useHeatmapSelectionHandlers(
    selectedModelIds,
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
        )!;
        setSelectedDataset(selectedCompoundDataset);
        setShowUnselectedLines(true);
        setSelectedDoses([]);
        setSelectedModelIds(new Set([]));
        setSelectedTableRows(new Set([]));
      }
    },
    [datasetOptions]
  );

  const handleFilterByDose = useCallback(
    (selections: Array<{ value: number; label: string }> | null) => {
      setSelectedDoses(selections ?? []);
    },
    []
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
            selectedDatasetOption={selectedDatasetOption}
            handleFilterByDose={handleFilterByDose}
            selectedDose={selectedDoses}
            showUnselectedLines={showUnselectedLines}
            handleToggleShowUnselectedLines={(nextValue: boolean) =>
              setShowUnselectedLines(nextValue)
            }
          />
        </div>
        <div className={styles.doseCurvesTabMain}>
          <HeatmapTabMainContent
            selectedPlotModelIds={selectedModelIds}
            selectedTableRows={selectedTableRows}
            showUnselectedLines={showUnselectedLines}
            doseUnits={doseUnits}
            compoundName={compoundName}
            selectedDoses={new Set(selectedDoses.map((d) => d.value))}
            handleSetSelectedPlotModels={handleSetSelectedPlotModels}
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

export default HeatmapTab;
