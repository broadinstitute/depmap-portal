import React, { useCallback, useMemo, useState } from "react";
import { useCorrelationContext } from "src/correlationAnalysis/context/useCorrelationContext";
import { useGeneCorrelationData } from "src/correlationAnalysis/hooks/useCorrelationAnalysisData";
import { useCorrelationUIState } from "src/correlationAnalysis/hooks/useCorrelationAnalysisUIState";
import {
  GeneCorrelationDatasetOption,
  SelectOption,
} from "src/correlationAnalysis/types";
import { GeneCorrelationContent } from "./CorrelationContent/GeneCorrelationContent";

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
  } = useCorrelationUIState(
    selectedDataset.datasetId,
    correlationAnalysisData,
    [],
    "gene"
  );

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
