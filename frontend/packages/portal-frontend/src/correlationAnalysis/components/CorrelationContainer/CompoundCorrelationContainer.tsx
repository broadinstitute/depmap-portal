import { DRCDatasetOptions } from "@depmap/types";

import React, { useCallback, useMemo, useState } from "react";
import { useCorrelationContext } from "src/correlationAnalysis/context/useCorrelationContext";
import { useCorrelationUIState } from "src/correlationAnalysis/hooks/useCorrelationAnalysisUIState";
import { SelectOption } from "src/correlationAnalysis/types";
import { CompoundCorrelationContent } from "./CorrelationContent/CompoundCorrelationContent";
import { useCompoundCorrelationData } from "src/correlationAnalysis/hooks/useCorrelationAnalysisData";

interface CompoundCorrelationContainerProps {
  compoundDatasetOptions: DRCDatasetOptions[];
  featureId: string;
  featureName: string;
}

export function CompoundCorrelationContainer({
  compoundDatasetOptions,
  featureId,
  featureName,
}: CompoundCorrelationContainerProps) {
  const { handleDosesChange } = useCorrelationContext();
  const [selectedDataset, setSelectedDataset] = useState<DRCDatasetOptions>(
    compoundDatasetOptions[0]
  );

  const {
    correlationAnalysisData,
    correlatedDatasets,
    doseColors,
    isLoading,
    hasError,
  } = useCompoundCorrelationData(selectedDataset, featureId, featureName);

  const {
    filteredTableData,
    volcanoData,
    selectedRows,
  } = useCorrelationUIState(
    selectedDataset.log_auc_dataset_given_id || "",
    correlationAnalysisData,
    doseColors,
    "compound"
  );

  const selectedDatasetOption = useMemo(
    () => ({
      value: selectedDataset.log_auc_dataset_given_id!,
      label: selectedDataset.display_name,
    }),
    [selectedDataset]
  );

  const doses = useMemo(() => doseColors.map((dc) => dc.dose), [doseColors]);

  const onChangeDataset = useCallback(
    (selection: SelectOption | null) => {
      if (selection) {
        const found = compoundDatasetOptions.find(
          (o) => o.log_auc_dataset_given_id === selection.value
        );
        if (found) {
          setSelectedDataset(found);
          handleDosesChange([]);
        }
      }
    },
    [compoundDatasetOptions, handleDosesChange]
  );

  return (
    <CompoundCorrelationContent
      featureName={featureName}
      compoundDatasetOptions={compoundDatasetOptions}
      isLoading={isLoading}
      hasError={hasError}
      correlatedDatasets={correlatedDatasets}
      filteredTableData={filteredTableData}
      volcanoData={volcanoData}
      selectedRows={selectedRows}
      doseColors={doseColors}
      doses={doses}
      selectedDatasetOption={selectedDatasetOption}
      onChangeDataset={onChangeDataset}
    />
  );
}
