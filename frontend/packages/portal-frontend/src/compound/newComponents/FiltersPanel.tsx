import React from "react";
import { CompoundDataset } from "../components/DoseResponseTab";

interface FiltersPanelProps {
  handleSelectDataset: (selection: CompoundDataset) => void;
  datasetOptions: CompoundDataset[];
}

const getAxisLabel = () => {
  // Different between repurposing and OncRef?
};

function FiltersPanel({
  handleSelectDataset,
  datasetOptions,
}: FiltersPanelProps) {
  return <div></div>;
}

export default FiltersPanel;
