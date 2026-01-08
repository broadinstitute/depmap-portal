import React, { useCallback, useMemo, useState } from "react";
import { useGeneCorrelationData } from "../hooks/useCorrelationAnalysisData";
import { GeneCorrelationDatasetOption, SelectOption } from "../types";
import { useCorrelationUIState } from "../hooks/useCorrelationAnalysisUIState";
import { useCorrelationContext } from "../context/useCorrelationContext";
import { GeneCorrelationContent } from "./GeneCorrelationContent";

interface GeneCorrelationContainerProps {
  geneDatasetOptions: GeneCorrelationDatasetOption[];
  featureId: string;
  featureName: string;
}

export function GeneCorrelationContainer({
  geneDatasetOptions,
  featureId,
  featureName,
}: GeneCorrelationContainerProps) {
  const { handleDosesChange } = useCorrelationContext();

  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<GeneCorrelationDatasetOption>(geneDatasetOptions[0]);

  const {
    correlationAnalysisData,
    correlatedDatasets,
    isLoading,
    hasError,
  } = useGeneCorrelationData(selectedDataset, featureId, featureName);

  const {
    filteredTableData,
    volcanoData,
    selectedRows,
  } = useCorrelationUIState(correlationAnalysisData, [], "gene");

  const selectedDatasetOption = useMemo(
    () => ({
      value: selectedDataset.datasetId,
      label: selectedDataset.displayName,
    }),
    [selectedDataset]
  );

  const onChangeDataset = useCallback(
    (selection: SelectOption | null) => {
      if (selection) {
        const found = geneDatasetOptions.find(
          (o) => o.datasetId === selection.value
        );
        if (found) {
          setSelectedDataset(found);
          handleDosesChange([]);
        }
      }
    },
    [geneDatasetOptions, handleDosesChange]
  );

  return (
    <GeneCorrelationContent
      featureName={featureName}
      geneDatasetOptions={geneDatasetOptions}
      isLoading={isLoading}
      hasError={hasError}
      correlatedDatasets={correlatedDatasets}
      filteredTableData={filteredTableData}
      volcanoData={volcanoData}
      selectedRows={selectedRows}
      selectedDatasetOption={selectedDatasetOption}
      onChangeDataset={onChangeDataset}
    />
  );
}
