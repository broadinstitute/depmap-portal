import React from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import styles from "./CompoundTiles.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import useHeatmapFormattedData from "../../heatmapTab/hooks/useHeatmapData";
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
