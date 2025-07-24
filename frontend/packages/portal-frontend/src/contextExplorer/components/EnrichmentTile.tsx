import React, { useCallback, useEffect, useRef, useState } from "react";
import { legacyPortalAPI } from "@depmap/api";
import { toStaticUrl } from "@depmap/globals";
import {
  ContextExplorerDatasets,
  EnrichedLineagesTileData,
} from "@depmap/types";
import InfoIcon from "src/common/components/InfoIcon";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
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
  useEffect(() => {
    setTileData(null);
    // setEntityDetailMainPlotElement(null);
    setIsLoadingBoxplot(true);
    // setBoxplotError(false);
    const boxplotPromise = legacyPortalAPI.getEnrichmentTileData(
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
  }, [setIsLoadingBoxplot, entityType, entityLabel]);

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
  }

  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="description of term"
      className="icon"
    />
  );

  const getCompoundToolTip = () => {
    if (tileData?.dataset_name === ContextExplorerDatasets.Prism_oncology_AUC) {
      return `Lineages and/or subtypes that have, on average, a stronger sensitivity to this compound compared to all other models. Enriched lineages/subtypes are calculated as in Context Explorer and selected based on default Context Explorer filters (T-test FDR<0.1, avg. AUC difference < -0.1).`;
    }
    return "Lineages and/or subtypes that have, on average, a stronger sensitivity to this compound compared to all other models. Enriched lineages/subtypes are calculated as in Context Explorer and selected based on default Context Explorer filters (T-test FDR<0.1, avg. log2(Viability) difference < -0.5).";
  };

  const tooltipText =
    entityType === "gene"
      ? "Lineages and/or subtypes that have, on average, a stronger dependency on this gene compared to all other models. Enriched lineages/subtypes are calculated as in Context Explorer and selected based on default Context Explorer filters (T-test FDR<0.1, avg. gene effect difference < -0.25 and min. 1 dependent in-group model)."
      : getCompoundToolTip();

  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Enriched Lineages{" "}
          {tileData && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{tooltipText}</p>}
              popoverId={`sidebar-genedep1-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        <div className="card_padding">
          {entityType === "gene" ? (
            <h4 className="crispr">{tileData?.dataset_display_name}</h4>
          ) : (
            <h4>{tileData?.dataset_display_name}</h4>
          )}
        </div>
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
