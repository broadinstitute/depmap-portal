import React, { useEffect, useRef, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { EnrichedLineagesTileData } from "../models/types";
import CollapsibleBoxPlots from "./contextAnalysis/CollapsibleBoxPlots";

interface EnrichmentTileProps {
  geneSymbol: string;
}

export const EnrichmentTile: React.FC<EnrichmentTileProps> = ({
  geneSymbol,
}) => {
  const [tileData, setTileData] = useState<EnrichedLineagesTileData | null>(
    null
  );
  const [isLoadingBoxplot, setIsLoadingBoxplot] = useState<boolean>(true);
  // const [boxplotError, setBoxplotError] = useState(false);
  const boxplotLatestPromise = useRef<Promise<EnrichedLineagesTileData> | null>(
    null
  );
  const dapi = getDapi();
  useEffect(() => {
    setTileData(null);
    // setEntityDetailMainPlotElement(null);
    setIsLoadingBoxplot(true);
    // setBoxplotError(false);
    const boxplotPromise = dapi.getEnrichmentTileData(
      "Lineage",
      "gene",
      geneSymbol
    );

    boxplotLatestPromise.current = boxplotPromise;

    boxplotPromise
      .then((dataVals) => {
        if (boxplotPromise === boxplotLatestPromise.current) {
          setTileData(dataVals);
        }
      })
      .catch((e) => {
        if (boxplotPromise === boxplotLatestPromise.current) {
          window.console.error(e);
          // setBoxplotError(true);
        }
      })
      .finally(() => setIsLoadingBoxplot(false));
  }, [setIsLoadingBoxplot, dapi, geneSymbol]);

  return (
    <div>
      {!tileData && isLoadingBoxplot && <PlotSpinner />}
      {tileData && (
        <CollapsibleBoxPlots
          handleSetMainPlotElement={(element: ExtendedPlotType | null) => {
            if (element) {
              /* do nothing */
            }
          }}
          topContextNameInfo={tileData.top_context_name_info}
          selectedCode={tileData.selected_context_name_info.subtype_code}
          boxPlotData={tileData.box_plot_data}
          entityType={"gene"}
        />
      )}
    </div>
  );
};
