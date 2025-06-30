import React, { useEffect, useCallback, useState } from "react";
import HeatmapTabMainContent from "./HeatmapTabMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../CompoundDoseViability.scss";
import { DoseTableDataProvider } from "../hooks/DoseTableDataContext";

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
  console.log(doseUnits);
  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<DRCDatasetOptions | null>(null);
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  } | null>(null);

  // NOTE: temporarily disabling insensitive lines filter until "insensitive" is better defined
  // const [showInsensitiveLines, setShowInsensitiveLines] =
  //   useState<boolean>(true);
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
        // setShowInsensitiveLines(true);
        setShowUnselectedLines(true);
      }
    },
    [datasetOptions]
  );

  // Change selectedDoses to be an array of selection objects
  const [selectedDoses, setSelectedDoses] = useState<
    { value: number; label: string }[]
  >([]);

  const handleFilterByDose = useCallback(
    (selections: Array<{ value: number; label: string }> | null) => {
      setSelectedDoses(selections ?? []);
    },
    []
  );

  return (
    <DeprecatedDataExplorerApiProvider
      evaluateLegacyContext={evaluateLegacyContext}
    >
      <DoseTableDataProvider dataset={selectedDataset} compoundId={compoundId}>
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
              showUnselectedLines={showUnselectedLines}
              handleToggleShowUnselectedLines={(nextValue: boolean) =>
                setShowUnselectedLines(nextValue)
              }
            />
          </div>
          <div className={styles.doseCurvesTabMain}>
            <HeatmapTabMainContent
              showUnselectedLines={showUnselectedLines}
              compoundName={compoundName}
              selectedDoses={new Set(selectedDoses.map((d) => d.value))}
              handleShowUnselectedLinesOnSelectionsCleared={() => {
                setShowUnselectedLines(true);
              }}
            />
          </div>
        </div>
      </DoseTableDataProvider>
    </DeprecatedDataExplorerApiProvider>
  );
}

export default HeatmapTab;
