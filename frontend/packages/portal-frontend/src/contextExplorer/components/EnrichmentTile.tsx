import React, { useCallback, useEffect, useRef, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  ContextExplorerDatasets,
  EnrichedLineagesTileData,
} from "../models/types";
import CollapsibleBoxPlots from "./boxPlots/CollapsibleBoxPlots";

interface EnrichmentTileProps {
  entityLabel: string;
  entityType: string;
}

export const EnrichmentTile: React.FC<EnrichmentTileProps> = ({
  entityLabel,
  entityType,
}) => {
  const contextExplorerHref = window.location.href
    .split(entityLabel)[0]
    .replace(entityType, "context_explorer");

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
      entityType,
      entityLabel
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
  }, [setIsLoadingBoxplot, dapi, entityType, entityLabel]);

  const getTabFromDatasetName = useCallback((datasetName: string) => {
    if (datasetName === ContextExplorerDatasets.Chronos_Combined.toString()) {
      return "geneDependency";
    }

    if (datasetName === ContextExplorerDatasets.Rep_all_single_pt.toString()) {
      return "repurposing";
    }

    return "oncref";
  }, []);

  if (
    !isLoadingBoxplot &&
    (!tileData?.box_plot_data.significant_selection ||
      tileData?.box_plot_data.significant_selection.length === 0)
  ) {
    if (
      tileData?.box_plot_data.insignificant_heme_data?.data.length === 0 ||
      tileData?.box_plot_data.insignificant_solid_data?.data.length === 0
    ) {
      return null;
    }

    return null;
  }

  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Enriched Lineages</h2>
        <div className="card_padding stacked-boxplot-graphs-padding">
          <div id="enrichment-tile">
            {!tileData && isLoadingBoxplot && <PlotSpinner />}
            {tileData && (
              <CollapsibleBoxPlots
                handleSetMainPlotElement={(
                  element: ExtendedPlotType | null
                ) => {
                  if (element) {
                    /* do nothing */
                  }
                }}
                topContextNameInfo={tileData.top_context_name_info}
                selectedCode={tileData.selected_context_name_info?.subtype_code}
                boxPlotData={tileData.box_plot_data}
                entityType={entityType}
                urlPrefix={contextExplorerHref}
                tab={getTabFromDatasetName(tileData.dataset_name)}
                datasetId={
                  ContextExplorerDatasets[
                    tileData.dataset_name as ContextExplorerDatasets
                  ]
                }
              />
            )}
          </div>
          {tileData && (
            <p className="stacked-boxplot-download-container">
              View more contexts in the{" "}
              <a href={tileData?.context_explorer_url}>Context Explorer</a>
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
