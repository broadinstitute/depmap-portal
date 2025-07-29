import React, { useCallback, useState } from "react";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../CompoundDoseViability.scss";
import { DoseViabilityDataProvider } from "../hooks/DoseViabilityDataContext";

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
  const [showReplicates, setShowReplicates] = useState<boolean>(true);
  const [showUnselectedLines, setShowUnselectedLines] = useState<boolean>(true);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
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
          setSelectedTableRows(new Set([]));
          setSelectedModelIds(new Set([]));
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
            selectedDatasetOption={selectedDatasetOption}
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
            doseUnits={doseUnits}
            showReplicates={showReplicates}
            showUnselectedLines={showUnselectedLines}
            compoundName={compoundName}
            handleShowUnselectedLinesOnSelectionsCleared={() => {
              setShowUnselectedLines(true);
            }}
            selectedModelIds={selectedModelIds}
            selectedTableRows={selectedTableRows}
            handleSetSelectedTableRows={setSelectedTableRows}
            handleSetSelectedPlotModelIds={setSelectedModelIds}
          />
        </div>
      </div>
    </DoseViabilityDataProvider>
  );
}

export default DoseCurvesTab;
