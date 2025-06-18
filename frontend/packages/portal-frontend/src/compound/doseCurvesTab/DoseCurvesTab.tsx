import React, { useEffect, useCallback, useState } from "react";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../CompoundDoseViability.scss";

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

  useEffect(() => {
    if (datasetOptions) {
      setSelectedDataset(datasetOptions[0]);
    }
  }, [datasetOptions]);

  const handleSelectDataset = useCallback(
    (selection: { value: string; label: string } | null) => {
      if (selection) {
        setSelectedDatasetOption(selection);
        const selectedCompoundDataset = datasetOptions.filter(
          (option: DRCDatasetOptions) =>
            option.viability_dataset_id === selection.value
        )[0];
        setSelectedDataset(selectedCompoundDataset);
        setShowReplicates(true);
        setShowUnselectedLines(true);
      }
    },
    [datasetOptions]
  );

  return (
    <DeprecatedDataExplorerApiProvider
      evaluateLegacyContext={evaluateLegacyContext}
    >
      <div className={styles.doseCurvesTabGrid}>
        <div className={styles.doseCurvesTabFilters}>
          <FiltersPanel
            handleSelectDataset={handleSelectDataset}
            datasetOptions={datasetOptions}
            selectedDatasetOption={
              selectedDatasetOption || {
                value: datasetOptions[0].viability_dataset_id,
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
            dataset={selectedDataset}
            doseUnits={doseUnits}
            showReplicates={showReplicates}
            showUnselectedLines={showUnselectedLines}
            compoundName={compoundName}
            compoundId={compoundId}
            handleShowUnselectedLinesOnSelectionsCleared={() => {
              setShowUnselectedLines(true);
            }}
          />
        </div>
      </div>
    </DeprecatedDataExplorerApiProvider>
  );
}

export default DoseCurvesTab;
