import React, { useEffect, useState } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import { HeatmapTile } from "./HeatmapTile";
import { legacyPortalAPI } from "@depmap/api";
import { DoseViabilityDataProvider } from "src/compound/hooks/DoseViabilityDataContext";

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
        compoundName
      );
      setDataset(prioritizedDataset);
      setIsLoading(false);
    })();
  }, [compoundId]);

  return (
    <DoseViabilityDataProvider dataset={dataset} compoundId={compoundId}>
      <HeatmapTile compoundName={compoundName} isLoadingDataset={isLoading} />
    </DoseViabilityDataProvider>
  );
};
