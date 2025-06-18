import React, { useEffect, useCallback, useState } from "react";
import HeatmapTabMainContent from "./HeatmapTabMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "./CompoundDoseCurves.scss";
import useDoseTableData from "./hooks/useDoseTableData";

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
  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<DRCDatasetOptions | null>(null);
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [showInsensitiveLines, setShowInsensitiveLines] = useState<boolean>(
    true
  );
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
        setShowInsensitiveLines(true);
        setShowUnselectedLines(true);
      }
    },
    [datasetOptions]
  );

  // Use the custom hook to get doseColumnNames and tableFormattedData
  const { doseColumnNames, tableFormattedData } = useDoseTableData(
    selectedDataset,
    compoundId,
    compoundName
  );

  const [selectedDoses, setSelectedDoses] = useState<Set<string>>(new Set());

  const handleFilterByDose = useCallback(
    (selection: { value: string; label: string } | null) => {
      if (!selection) return;
      setSelectedDoses((prev) => {
        const next = new Set(prev);
        if (next.has(selection.value)) {
          next.delete(selection.value);
        } else {
          next.add(selection.value);
        }
        return next;
      });
    },
    []
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
            handleFilterByDose={handleFilterByDose}
            doseOptions={new Set(doseColumnNames)}
            selectedDoseOption={Array.from(selectedDoses).map((dose) => ({
              value: dose,
              label: dose,
            }))}
            showInsensitiveLines={showInsensitiveLines}
            showUnselectedLines={showUnselectedLines}
            handleToggleShowInsensitiveLines={(nextValue: boolean) =>
              setShowInsensitiveLines(nextValue)
            }
            handleToggleShowUnselectedLines={(nextValue: boolean) =>
              setShowUnselectedLines(nextValue)
            }
          />
        </div>
        <div className={styles.doseCurvesTabMain}>
          <HeatmapTabMainContent
            dataset={selectedDataset}
            doseUnits={doseUnits}
            showInsensitiveLines={showInsensitiveLines}
            showUnselectedLines={showUnselectedLines}
            compoundName={compoundName}
            compoundId={compoundId}
            doseColumnNames={doseColumnNames}
            tableFormattedData={tableFormattedData}
            selectedDoses={selectedDoses}
            handleShowUnselectedLinesOnSelectionsCleared={() => {
              setShowUnselectedLines(true);
            }}
          />
        </div>
      </div>
    </DeprecatedDataExplorerApiProvider>
  );
}

export default HeatmapTab;
