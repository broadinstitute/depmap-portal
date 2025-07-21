import React, { useEffect, useState } from "react";
import { DoseTableDataProvider } from "../../hooks/DoseTableDataContext";
import { DRCDatasetOptions } from "@depmap/types";
import { HeatmapTile } from "./HeatmapTile";
import { legacyPortalAPI } from "@depmap/api";

interface HeatmapTileContainerProps {
  compoundId: string;
  compoundName: string;
}

export const HeatmapTileContainer: React.FC<HeatmapTileContainerProps> = ({
  compoundId,
  compoundName,
}) => {
  const [dataset, setDataset] = useState<DRCDatasetOptions | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const prioritizedDataset = await legacyPortalAPI.getPrioritizedDataset(
        compoundId
      );
      setDataset(prioritizedDataset);
      setIsLoading(false);
    })();
  }, [compoundId]);

  return (
    <DoseTableDataProvider dataset={dataset} compoundId={compoundId}>
      <HeatmapTile compoundName={compoundName} isLoadingDataset={isLoading} />
    </DoseTableDataProvider>
  );
};
