import React from "react";
import { DoseTableDataProvider } from "../../hooks/DoseTableDataContext";
import { DRCDatasetOptions } from "@depmap/types";
import { HeatmapTile } from "./HeatmapTile";

interface HeatmapTileContainerProps {
  compoundId: string;
  dataset: DRCDatasetOptions;
}

export const HeatmapTileContainer: React.FC<HeatmapTileContainerProps> = ({
  compoundId,
  dataset,
}) => {
  return (
    <DoseTableDataProvider dataset={dataset} compoundId={compoundId}>
      <HeatmapTile />
    </DoseTableDataProvider>
  );
};
