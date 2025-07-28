import React, { useCallback, useState } from "react";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
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
        }
      }
    },
    [datasetOptions]
  );

  return (
    <DeprecatedDataExplorerApiProvider
      evaluateLegacyContext={evaluateLegacyContext}
    >
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
              doseUnits={doseUnits}
              showReplicates={showReplicates}
              showUnselectedLines={showUnselectedLines}
              compoundName={compoundName}
              handleShowUnselectedLinesOnSelectionsCleared={() => {
                setShowUnselectedLines(true);
              }}
            />
          </div>
        </div>
      </DoseViabilityDataProvider>
    </DeprecatedDataExplorerApiProvider>
  );
}

export default DoseCurvesTab;
