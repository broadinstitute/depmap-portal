import React, { useMemo } from "react";
import { CompoundFilters } from "./CompoundFilters";
import { GeneFilters } from "./GeneFilters";
import { CorrelationFiltersProps } from "./types";

export function CorrelationFilters(props: CorrelationFiltersProps) {
  const {
    selectedDatasetOption,
    onChangeDataset,
    correlatedDatasets,
    featureType,
  } = props;

  const correlatedOptions = useMemo(
    () => correlatedDatasets.map((d) => ({ label: d, value: d })),
    [correlatedDatasets]
  );

  if (featureType === "gene") {
    return (
      <GeneFilters
        geneDatasetOptions={props.geneDatasetOptions}
        selectedDatasetOption={selectedDatasetOption}
        onChangeDataset={onChangeDataset}
        correlatedDatasetOptions={correlatedOptions}
      />
    );
  }

  return (
    <CompoundFilters
      compoundDatasetOptions={props.compoundDatasetOptions}
      selectedDatasetOption={selectedDatasetOption}
      onChangeDataset={onChangeDataset}
      correlatedDatasetOptions={correlatedOptions}
      doses={props.doses}
    />
  );
}
