import React, { useCallback, useState } from "react";
import HeatmapTabMainContent from "./HeatmapTabMainContent";
import FiltersPanel from "./FiltersPanel";
import { DRCDatasetOptions } from "@depmap/types";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../CompoundDoseViability.scss";
import { DoseViabilityDataProvider } from "../hooks/DoseViabilityDataContext";

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

  const handleSelectDataset = useCallback(
    (selection: { value: string; label: string } | null) => {
      if (selection) {
        setSelectedDatasetOption(selection);
        const selectedCompoundDataset = datasetOptions.filter(
          (option: DRCDatasetOptions) =>
            option.viability_dataset_given_id === selection.value
        )[0];
        setSelectedDataset(selectedCompoundDataset);
        setShowUnselectedLines(true);
        setSelectedDoses([]);
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
            showUnselectedLines={showUnselectedLines}
            doseUnits={doseUnits}
            compoundName={compoundName}
            selectedDoses={new Set(selectedDoses.map((d) => d.value))}
            handleShowUnselectedLinesOnSelectionsCleared={() => {
              setShowUnselectedLines(true);
            }}
          />
        </div>
      </div>
    </DoseViabilityDataProvider>
  );
}

export default HeatmapTab;
