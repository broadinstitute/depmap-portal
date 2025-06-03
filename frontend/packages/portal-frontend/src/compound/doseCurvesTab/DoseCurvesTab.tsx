import React, { useEffect, useCallback, useState } from "react";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesMainContent from "./DoseCurvesMainContent";
import FiltersPanel from "./FiltersPanel";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";

interface DoseCurvesTabProps {
  datasetOptions: CompoundDataset[];
  doseUnits: string;
  compoundName: string;
}

function DoseCurvesTab({
  datasetOptions,
  doseUnits,
  compoundName,
}: DoseCurvesTabProps) {
  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<CompoundDataset | null>(null);
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  // const [error, setError] = useState(false);
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
          (option: CompoundDataset) => option.dataset === selection.value
        )[0];
        setSelectedDataset(selectedCompoundDataset);
      }
    },
    [datasetOptions]
  );

  return (
    <DeprecatedDataExplorerApiProvider
      evaluateLegacyContext={evaluateLegacyContext}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 7fr",
          gridTemplateAreas: "'filters main main main main main main main'",
          gap: "2rem",
        }}
      >
        <div
          style={{
            gridArea: "filters",
            backgroundColor: "rgba(123, 140, 178, 0.1)",
            paddingLeft: "12px",
            paddingRight: "12px",
            paddingTop: "15px",
          }}
        >
          <FiltersPanel
            handleSelectDataset={handleSelectDataset}
            datasetOptions={datasetOptions}
            selectedDatasetOption={
              selectedDatasetOption || {
                value: datasetOptions[0].dataset,
                label: datasetOptions[0].auc_dataset_display_name,
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
        <div style={{ gridArea: "main" }}>
          <DoseCurvesMainContent
            dataset={selectedDataset}
            doseUnits={doseUnits}
            showReplicates={showReplicates}
            showUnselectedLines={showUnselectedLines}
            compoundName={compoundName}
            handleShowUnselectedLinesOnSelectionsCleared={() =>
              setShowUnselectedLines(true)
            }
          />
        </div>
      </div>
    </DeprecatedDataExplorerApiProvider>
  );
}

export default DoseCurvesTab;
