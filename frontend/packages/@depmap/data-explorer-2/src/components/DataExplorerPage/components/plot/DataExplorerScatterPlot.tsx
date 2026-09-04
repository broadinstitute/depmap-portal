import React, { useEffect, useMemo, useState } from "react";
import { isPortal } from "@depmap/globals";
import {
  DataExplorerContextV2,
  DataExplorerExpansion,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
  entityRefKey,
} from "@depmap/types";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import type ExtendedPlotType from "../../ExtendedPlotType";
import SpinnerOverlay from "./SpinnerOverlay";
import useScatterPlotData from "./prototype/useScatterPlotData";
import PrototypeScatterPlot from "./prototype/PrototypeScatterPlot";
import SmallMultiplesScatter from "./prototype/SmallMultiplesScatter";
import { chosenCategoriesFor, computeFacets } from "./prototype/plotUtils";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import PlotLegend from "./PlotLegend";
import PlotFacets from "./PlotFacets";
import PlotSelections from "./PlotSelections";
import ExpandedPlotSelections from "./ExpandedPlotSelections";
import GeneTea from "./integrations/GeneTea";
import SectionStack, { StackableSection } from "../SectionStack";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import useSelection from "../../hooks/useSelection";
import styles from "../../styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  isLoading: boolean;
  linreg_by_group: LinRegInfo[] | null;
  onClickColorByContext: (context: DataExplorerContextV2) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedIds: Set<string>
  ) => void;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedIds: Set<string>
  ) => void;
  plotConfig: DataExplorerPlotConfig;
  canShowIdentityLine: boolean;
  onChangeCategories?: (
    target: "color" | "facet",
    categories: string[] | null
  ) => void;
  onChangeExpansionMembers?: (members: string[] | null) => void;
}

function DataExplorerScatterPlot({
  data,
  isLoading,
  linreg_by_group,
  onClickColorByContext,
  onClickSaveSelectionAsContext,
  onClickVisualizeSelected,
  plotConfig,
  canShowIdentityLine,
  onChangeCategories = undefined,
  onChangeExpansionMembers = undefined,
}: Props) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const {
    selection,
    selectedPoints,
    pointsToAnnotate,
    handleClickPoint,
    handleMultiselect,
    setSelection,
    setSelectionFromContext,
    clearSelection,
    selectionKeyForPoint,
  } = useSelection(data, plotConfig.facet_by);

  // Expanded plots (the response carries an expansion) get a different
  // selection panel: ExpandedPlotSelections lists (index, expansion)
  // pairs instead of collapsing them to index entities. Structural read
  // on the expansion shape, matching the idiom in plotUtils / useSelection.
  const isExpanded =
    ((data as { expansions?: DataExplorerExpansion[] } | null)?.expansions
      ?.length ?? 0) > 0;

  // Panel-follows-grain: the pair panel (ExpandedPlotSelections) only makes
  // sense when selection is pair-grained. Under facet_by === "expansion"
  // selection collapses to models, so the pair panel would match nothing —
  // show the model PlotSelections instead (its Visualize / Save-as-context
  // operations are meaningful for models). Mirrors `pairGrained` in
  // useSelection.
  const isPairGrained = isExpanded && plotConfig.facet_by !== "expansion";

  // Small multiples = the 2D realization of facet_by. facet_by is a fully
  // independent axis from color_by and never falls back to it: auto-faceting
  // a colored scatter by its own color dimension would explode into
  // per-category panels. So facet only on an *explicit* facet_by, read from
  // the facet triad (dimensions.facet / metadata.facet_property /
  // filters.facet1+facet2), never the color one. computeFacets is
  // shared with the per-facet regression fit (useScatterPlotData) and the
  // regression table (computeFacetedLinReg), so all three agree on facet
  // identity/labels.
  // Hoisted so the memo depends on the value rather than the whole config,
  // which would re-run it for every unrelated edit.
  const facetChosen = chosenCategoriesFor(plotConfig, "facet");

  const facetInfo = useMemo(
    () => computeFacets(data, plotConfig.facet_by, "facet", facetChosen),
    [data, plotConfig.facet_by, facetChosen]
  );
  const facetKeys = facetInfo?.facetKeys ?? null;
  const facetOrder = facetInfo?.facetOrder;
  const isFaceted = Boolean(facetKeys);
  const [showSpinner, setShowSpinner] = useState(isLoading);
  const { plotStyles } = useDataExplorerSettings();
  const {
    pointSize,
    facetedPointSize,
    pointOpacity,
    outlineWidth,
    palette,
    xAxisFontSize,
    yAxisFontSize,
  } = plotStyles;

  const {
    formattedData,
    continuousBins,
    contLegendKeys,
    legendState,
    facetLegendState,
    colorMap,
    legendForDownload,
    pointVisibility,
    regressionLines,
    regressionLinesByFacet,
    showIdentityLine,
    colorTarget,
    colorMatchesFacet,
  } = useScatterPlotData(
    data,
    plotConfig,
    linreg_by_group,
    palette,
    canShowIdentityLine
  );

  const {
    hiddenLegendValues: hiddenFacetValues,
    onClickLegendItem: onClickFacetItem,
    handleClickShowAll: handleClickShowAllFacets,
    handleClickHideAll: handleClickHideAllFacets,
  } = facetLegendState;

  // Shown only when color_by/facet_by have actually diverged (the Legend no
  // longer doubles as the facet key) and facet_by has real backing to show.
  // !colorMatchesFacet, not resolveColorMode(...).target === "color" alone —
  // see useDensity1DPlotData's colorMatchesFacet comment for why.
  const showFacetsPanel = !colorMatchesFacet && isFaceted;

  const {
    hiddenLegendValues,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  } = legendState;

  // When facets follow color (colorMatchesFacet), the Legend doubles as the
  // facet key and toggling a legend entry IS toggling that facet — so it
  // should fully remove the panel from the grid, exactly like the separate
  // Facets panel already does when facet_by is independent (hiddenFacetValues,
  // used below in the !colorMatchesFacet case). hiddenLegendValues lives in
  // colorMap's raw LegendKey space (a real category string, or a shared
  // Symbol like LEGEND_OTHER/LEGEND_BOTH/LEGEND_RANGE_N for the "Other"/
  // "Both"/continuous-bin cases), while SmallMultiplesScatter's hiddenFacets
  // works in facetKeys' plain-string space — facetColorKeys (computeFacets's
  // own reverse-lookup table, also used by regressionLinesByFacet's color
  // lookup) bridges the two.
  const hiddenFacetsFromLegend = useMemo(() => {
    if (!colorMatchesFacet || !facetKeys) {
      return null;
    }
    const out = new Set<string>();
    facetKeys.forEach((f) => {
      const legendKey = facetInfo?.facetColorKeys?.[f] ?? f;
      if (hiddenLegendValues.has(legendKey)) {
        out.add(f);
      }
    });
    return out;
  }, [colorMatchesFacet, facetKeys, facetInfo, hiddenLegendValues]);

  useEffect(() => {
    let timeout: number | undefined;

    if (!isLoading) {
      setShowSpinner(false);
    } else {
      timeout = window.setTimeout(() => setShowSpinner(true), 0);
    }

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const slice_type0 = plotConfig.dimensions.x?.slice_type;
  const slice_type1 = plotConfig.dimensions.y?.slice_type;

  useEffect(() => {
    clearSelection();
  }, [slice_type0, slice_type1, clearSelection]);

  // When the data changes (filter change, dataset switch, etc.), drop any
  // selected refs that no longer correspond to a point in the new response.
  // Done in terms of the derived ref key so both "single" and "pair"
  // selections work uniformly.
  useEffect(() => {
    if (!data?.index_ids) {
      return;
    }

    // Valid keys must be built in the SAME grain as the selection refs (via
    // useSelection's selectionKeyForPoint) — otherwise a model-grained
    // selection (facet_by === "expansion") would be measured against pair keys
    // and wiped on every data change.
    const validKeys = new Set<string>();
    for (let i = 0; i < data.index_ids.length; i += 1) {
      validKeys.add(selectionKeyForPoint(i));
    }

    setSelection((current) => {
      if (!current) {
        return null;
      }
      let next = current;
      current.forEach((ref) => {
        if (!validKeys.has(entityRefKey(ref))) {
          next = next.delete(ref);
        }
      });
      return next;
    });
  }, [data, setSelection, selectionKeyForPoint]);

  // Legacy panel compat: derive a Set<string> of index ids from the
  // structured selection. PlotSelections still keys on `data.index_ids`,
  // and the parent's onClickVisualizeSelected / onClickSaveSelectionAsContext
  // callbacks expect a Set<string>. For single-ref selections this is a
  // lossless identity; for pair-ref selections, multiple pairs of the
  // same model collapse to one index id — the same shape the legacy code
  // produced (and one the legacy operations know how to consume).
  //
  // Patch 5 introduces ExpandedPlotSelections which consumes `selection`
  // directly for expanded plots; once that lands this `selectedIdsLegacy`
  // remains only for the non-expanded path and for the parent callbacks.
  const selectedIdsLegacy = useMemo<Set<string> | null>(() => {
    if (!selection) {
      return null;
    }
    const out = new Set<string>();
    selection.forEach((ref) => out.add(ref.indexId));
    return out;
  }, [selection]);

  // GeneTea consumes display labels (gene symbols), not IDs. Derive from
  // selection's index ids — index labels are the depmap_model / gene label
  // path, unchanged by the migration. (For expanded plots, what GeneTea
  // *should* consume — model labels or the expansion's labels — is an
  // open question, but the migration shouldn't decide it; existing
  // semantics preserved.)
  const selectedLabels = useMemo(() => {
    if (!data?.index_ids || !selection) {
      return null;
    }

    const idToLabel: Record<string, string> = {};
    for (let i = 0; i < data.index_ids.length; i += 1) {
      idToLabel[data.index_ids[i]] = data.index_labels[i];
    }

    const out = new Set<string>();
    selection.forEach((ref) => {
      const label = idToLabel[ref.indexId];
      if (label !== undefined) {
        out.add(label);
      }
    });
    return out;
  }, [data, selection]);

  return (
    <div className={styles.DataExplorerScatterPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls
            data={data}
            plotConfig={plotConfig}
            isLoading={showSpinner}
            plotElement={plotElement}
            handleClickPoint={handleClickPoint}
            onClickUnselectAll={clearSelection}
          />
        </div>
        <div className={styles.plot}>
          {showSpinner && <SpinnerOverlay />}
          {formattedData &&
            (isFaceted ? (
              <SmallMultiplesScatter
                data={formattedData}
                xKey="x"
                yKey="y"
                pointVisibility={pointVisibility || undefined}
                colorKey1="color1"
                colorKey2="color2"
                categoricalColorKey="catColorData"
                continuousColorKey="contColorData"
                contLegendKeys={contLegendKeys}
                colorMap={colorMap}
                hoverTextKey="hoverText"
                annotationTextKey="annotationText"
                height="auto"
                xLabel={formattedData?.xLabel || ""}
                yLabel={formattedData?.yLabel || ""}
                legendForDownload={legendForDownload}
                facetKeys={facetKeys ?? []}
                facetOrder={facetOrder}
                // When color_by/facet_by have converged, hide via the
                // Legend's own toggles (translated to facet-key-string
                // space, see hiddenFacetsFromLegend above); otherwise via
                // the independent Facets panel's own state
                // (hiddenFacetValues, already in that string space —
                // computeFacets always returns plain strings for scatter's
                // facetKeys/facetOrder, see its own comment on why — so
                // that's a direct pass-through, not a real conversion).
                hiddenFacets={
                  (hiddenFacetsFromLegend ?? hiddenFacetValues) as Set<string>
                }
                placeholderEmptyFacets={Boolean(plotConfig.expand_by?.length)}
                showIdentityLine={showIdentityLine}
                regressionLinesByFacet={regressionLinesByFacet}
                onLoad={setPlotElement}
                onClickPoint={handleClickPoint}
                onMultiselect={handleMultiselect}
                selectedPoints={selectedPoints}
                pointsToAnnotate={pointsToAnnotate}
                selectionCount={selection?.size ?? 0}
                onClickResetSelection={clearSelection}
                pointSize={facetedPointSize}
                pointOpacity={pointOpacity}
                outlineWidth={outlineWidth}
                palette={palette}
                xAxisFontSize={xAxisFontSize}
                yAxisFontSize={yAxisFontSize}
              />
            ) : (
              // hasFacetOptionsEnabled intentionally left unset here: this
              // branch only renders when !isFaceted, i.e. facet_by has no
              // real backing (a real facet_by always routes to
              // SmallMultiplesScatter above instead) — so there's nothing
              // real for this prop to report at this call site.
              <PrototypeScatterPlot
                data={formattedData}
                xKey="x"
                yKey="y"
                pointVisibility={pointVisibility || undefined}
                colorKey1="color1"
                colorKey2="color2"
                categoricalColorKey="catColorData"
                continuousColorKey="contColorData"
                contLegendKeys={contLegendKeys}
                colorMap={colorMap}
                hoverTextKey="hoverText"
                annotationTextKey="annotationText"
                height="auto"
                xLabel={formattedData?.xLabel || ""}
                yLabel={formattedData?.yLabel || ""}
                onLoad={setPlotElement}
                onClickPoint={handleClickPoint}
                onMultiselect={handleMultiselect}
                selectedPoints={selectedPoints}
                pointsToAnnotate={pointsToAnnotate}
                selectionCount={selection?.size ?? 0}
                showIdentityLine={showIdentityLine}
                regressionLines={regressionLines}
                onClickResetSelection={clearSelection}
                legendForDownload={legendForDownload}
                pointSize={pointSize}
                pointOpacity={pointOpacity}
                outlineWidth={outlineWidth}
                palette={palette}
                xAxisFontSize={xAxisFontSize}
                yAxisFontSize={yAxisFontSize}
              />
            ))}
        </div>
      </div>
      <div className={styles.right}>
        <SectionStack>
          <StackableSection title="Legend" minHeight={132}>
            <PlotLegend
              data={data}
              colorMap={colorMap}
              continuousBins={continuousBins}
              hiddenLegendValues={hiddenLegendValues}
              onClickLegendItem={onClickLegendItem}
              handleClickShowAll={handleClickShowAll}
              handleClickHideAll={handleClickHideAll}
              target={colorTarget}
              plotConfig={plotConfig}
              onChangeCategories={onChangeCategories}
              onChangeExpansionMembers={onChangeExpansionMembers}
            />
          </StackableSection>
          {showFacetsPanel ? (
            <StackableSection title="Facets" minHeight={160}>
              <PlotFacets
                data={data}
                facetKeys={facetOrder ?? []}
                continuousBins={null}
                hiddenFacetValues={hiddenFacetValues}
                onClickFacetItem={onClickFacetItem}
                handleClickShowAllFacets={handleClickShowAllFacets}
                handleClickHideAllFacets={handleClickHideAllFacets}
                plotConfig={plotConfig}
                onChangeCategories={onChangeCategories}
                onChangeExpansionMembers={onChangeExpansionMembers}
              />
            </StackableSection>
          ) : null}
          <StackableSection
            title="Plot Selections"
            minHeight={256}
            defaultOpen={!plotConfig.expand_by}
          >
            {isPairGrained ? (
              <ExpandedPlotSelections
                data={data}
                selection={selection}
                onClickClearSelection={clearSelection}
              />
            ) : (
              <PlotSelections
                data={data}
                plot_type={plotConfig?.plot_type || null}
                selectedIds={selectedIdsLegacy}
                onClickVisualizeSelected={(e) =>
                  onClickVisualizeSelected(e, selectedIdsLegacy as Set<string>)
                }
                onClickSaveSelectionAsContext={() => {
                  onClickSaveSelectionAsContext(
                    plotConfig.index_type,
                    selectedIdsLegacy as Set<string>
                  );
                }}
                onClickClearSelection={clearSelection}
                onClickSetSelectionFromContext={async () => {
                  const newSelectedIds = await promptForSelectionFromContext(
                    data!
                  );

                  if (newSelectedIds === null) {
                    return;
                  }

                  // Context resolution names entities of one type, never
                  // pairs. setSelectionFromContext sets the selection to those
                  // ids (models) and the annotation set to one representative
                  // point per id; it returns the representative points so we
                  // can position their labels before the next render.
                  const repPoints = setSelectionFromContext([
                    ...newSelectedIds,
                  ]);
                  plotElement?.annotateSelected(repPoints);
                }}
              />
            )}
          </StackableSection>
          {isPortal && plotConfig.index_type === "gene" ? (
            <StackableSection
              title="GeneTEA Enriched Terms"
              minHeight={200}
              defaultOpen={false}
            >
              <GeneTea
                selectedLabels={selectedLabels}
                onClickColorByContext={onClickColorByContext}
              />
            </StackableSection>
          ) : null}
        </SectionStack>
      </div>
    </div>
  );
}

export default DataExplorerScatterPlot;
