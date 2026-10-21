import React, { useEffect, useMemo, useState } from "react";
import type { Layout } from "plotly.js";
import {
  Settings,
  useDataExplorerSettings,
} from "../../../../contexts/DataExplorerSettingsContext";
import { isPortal } from "@depmap/globals";
import SpinnerOverlay from "./SpinnerOverlay";
import type ExtendedPlotType from "../../ExtendedPlotType";
import {
  DataExplorerContextV2,
  DataExplorerExpansion,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  entityRefKey,
} from "@depmap/types";
import useDensity1DPlotData from "./prototype/useDensity1DPlotData";
import PrototypeDensity1D from "./prototype/PrototypeDensity1D";
import { AnnotationTail, LegendInfo } from "./prototype/plotUtils";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import SectionStack, { StackableSection } from "../SectionStack";
import PlotLegend from "./PlotLegend";
import PlotFacets from "./PlotFacets";
import PlotSelections from "./PlotSelections";
import ExpandedPlotSelections from "./ExpandedPlotSelections";
import GeneTea from "./integrations/GeneTea";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import useSelection from "../../hooks/useSelection";
import styles from "../../styles/DataExplorer2.scss";

// What a caller must supply to draw this plot — mirrors
// DataExplorerScatterPlot's identically-named type, needed here for the
// same reason: the export modal draws a second, hidden instance at edited
// styles and possibly-seeded view state, and must not be able to wire it
// up to mutate the real selection.
interface RenderPlotOptions {
  plotStyles: Settings["plotStyles"];
  onLoad: (plot: ExtendedPlotType) => void;
  interactive: boolean;
  initialAxes?: Partial<Layout>;
  initialAnnotationTails?: Record<string, AnnotationTail>;
}

interface Props {
  data: DataExplorerPlotResponse | null;
  isLoading: boolean;
  plotConfig: DataExplorerPlotConfig;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedIds: Set<string>
  ) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedIds: Set<string>
  ) => void;
  onClickColorByContext: (context: DataExplorerContextV2) => void;
  onChangeCategories?: (
    target: "color" | "facet",
    categories: string[] | null
  ) => void;
  onChangeExpansionMembers?: (members: string[] | null) => void;
}

function DataExplorerDensity1DPlot({
  data,
  isLoading,
  plotConfig,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickColorByContext,
  onChangeCategories = undefined,
  onChangeExpansionMembers = undefined,
}: Props) {
  // Expanded plots (facet_by "expansion") are the one and only trigger for
  // confining selection to a single facet.
  const enforceSingleFacetSelection = plotConfig.facet_by === "expansion";
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
  const [showSpinner, setShowSpinner] = useState(isLoading);
  const { plotStyles } = useDataExplorerSettings();
  // Only `palette` is read directly (useDensity1DPlotData needs it ahead of
  // the render below) — everything else now comes through renderPlot's own
  // `plotStyles` param, so the preview can pass its own draft values instead
  // of always reading the saved ones.
  const { palette } = plotStyles;

  const {
    formattedData,
    continuousBins,
    colorData,
    facetData,
    sortedFacetKeys,
    facetContinuousBins,
    legendState,
    facetLegendState,
    colorMap,
    legendDisplayNames,
    facetDisplayNames,
    legendTitle,
    pointVisibility,
    colorTarget,
    colorMatchesFacet,
    hasFacetOptionsEnabled,
  } = useDensity1DPlotData(data, plotConfig, palette);

  const {
    hiddenLegendValues,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  } = legendState;

  const {
    hiddenLegendValues: hiddenFacetValues,
    onClickLegendItem: onClickFacetItem,
    handleClickShowAll: handleClickShowAllFacets,
    handleClickHideAll: handleClickHideAllFacets,
  } = facetLegendState;

  // Shown only when color_by/facet_by have actually diverged (the Legend no
  // longer doubles as the facet key) and facet_by has real backing to show.
  // !colorMatchesFacet, not resolveColorMode(...).target === "color" alone —
  // an explicit color_by that happens to name the identical source as
  // facet_by (without using the "facet" sentinel) still makes Legend the
  // facet partition, so the panel would be redundant. See colorMatchesFacet's
  // own comment for why this is broader than a target check.
  const showFacetsPanel = !colorMatchesFacet && hasFacetOptionsEnabled;

  useEffect(() => {
    let timeout: number | undefined;

    if (!isLoading) {
      setShowSpinner(false);
    } else {
      timeout = window.setTimeout(() => setShowSpinner(true), 0);
    }

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const { slice_type } = plotConfig.dimensions
    .x as DataExplorerPlotConfigDimension;

  useEffect(() => {
    clearSelection();
  }, [slice_type, clearSelection]);

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
  // structured selection. See DataExplorerScatterPlot for full rationale.
  // Replaced by ExpandedPlotSelections (patch 5) for expanded plots.
  const selectedIdsLegacy = useMemo<Set<string> | null>(() => {
    if (!selection) {
      return null;
    }
    const out = new Set<string>();
    selection.forEach((ref) => out.add(ref.indexId));
    return out;
  }, [selection]);

  // GeneTea consumes display labels (gene symbols), not IDs. Derive from
  // selection's index ids. Existing semantics preserved (index labels).
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

  // Extracted so the export modal's hidden preview instance (drawn at
  // edited styles, and possibly seeded view state) and the main plot are
  // built from the same ~30-prop call site instead of two that could drift.
  // Mirrors DataExplorerScatterPlot's identically-named helper.
  const renderPlot = ({
    plotStyles: styles_,
    onLoad,
    interactive,
    initialAxes,
    initialAnnotationTails,
  }: RenderPlotOptions) => {
    if (!formattedData) {
      return null;
    }

    // A preview must not be able to mutate the real selection, so it simply
    // isn't wired to the handlers that would. Their defaults are no-ops —
    // see PrototypeDensity1D's own.
    const interactions = interactive
      ? {
          onClickPoint: handleClickPoint,
          onMultiselect: handleMultiselect,
          onClickResetSelection: clearSelection,
        }
      : {};

    return (
      <PrototypeDensity1D
        data={formattedData}
        xKey="x"
        colorMap={colorMap}
        colorData={colorData}
        facetData={facetData}
        groupKeys={sortedFacetKeys}
        colorMatchesFacet={colorMatchesFacet}
        continuousColorKey="contColorData"
        legendDisplayNames={legendDisplayNames}
        facetDisplayNames={facetDisplayNames}
        legendTitle={legendTitle}
        pointVisibility={pointVisibility || undefined}
        useSemiOpaqueViolins={!plotConfig.hide_points}
        placeholderEmptyTracks={Boolean(plotConfig.expand_by?.length)}
        enforceSingleFacetSelection={enforceSingleFacetSelection}
        pointsToAnnotate={pointsToAnnotate}
        selectionCount={selection?.size ?? 0}
        hoverTextKey="hoverText"
        annotationTextKey="annotationText"
        height="auto"
        onLoad={onLoad}
        selectedPoints={selectedPoints}
        hiddenLegendValues={hiddenLegendValues}
        hiddenFacetValues={hiddenFacetValues}
        // hasFacetOptionsEnabled, not Boolean(sortedFacetKeys): an
        // unset facet_by still yields one LEGEND_ALL track, so
        // sortedFacetKeys is never empty and would report every plot
        // as faceted. See useDensity1DPlotData's own note on this.
        pointSize={
          hasFacetOptionsEnabled ? styles_.facetedPointSize : styles_.pointSize
        }
        pointOpacity={styles_.pointOpacity}
        outlineWidth={styles_.outlineWidth}
        palette={styles_.palette}
        annotationFontSize={styles_.annotationFontSize}
        xAxisFontSize={styles_.xAxisFontSize}
        yAxisFontSize={styles_.yAxisFontSize}
        initialAxes={initialAxes}
        initialAnnotationTails={initialAnnotationTails}
        {...interactions}
      />
    );
  };

  // The same object PrototypeDensity1D builds internally for its own
  // legend traces (see its getImageFigure) — colorKeys minus whatever's
  // hidden, named and colored the same way. Duplicated rather than shared
  // because that derivation lives inside the renderer and isn't exposed;
  // the underlying colorMap/hiddenLegendValues/legendDisplayNames are the
  // very same props/state passed to it, so the two can't drift apart.
  const legendForDownload: LegendInfo = {
    title: legendTitle ?? "",
    items: [...colorMap.keys()]
      .filter((key) => !hiddenLegendValues.has(key))
      .map((key) => ({
        name: legendDisplayNames[key] ?? "",
        hexColor: colorMap.get(key) as string,
      })),
  };

  return (
    <div className={styles.DataExplorerDensity1DPlot}>
      <div className={styles.left}>
        <div className={styles.plotControls}>
          <DataExplorerPlotControls
            data={data}
            isLoading={showSpinner}
            plotConfig={plotConfig}
            plotElement={plotElement}
            handleClickPoint={handleClickPoint}
            onClickUnselectAll={clearSelection}
            previewPlot={{
              render: (options: Omit<RenderPlotOptions, "interactive">) =>
                renderPlot({ ...options, interactive: false }),
              pointSizeField: hasFacetOptionsEnabled
                ? "facetedPointSize"
                : "pointSize",
              legend: legendForDownload,
              // No y=x/regression lines and no real y-axis title here — the
              // y-axis is a synthetic jitter value, not a labeled axis.
              hasDataLines: false,
              hasYAxisLabel: false,
              hasViolinLines: true,
            }}
          />
        </div>
        <div className={styles.plot}>
          {showSpinner && <SpinnerOverlay />}
          {renderPlot({
            plotStyles,
            onLoad: setPlotElement,
            interactive: true,
          })}
        </div>
      </div>
      <div className={styles.right}>
        <SectionStack>
          <StackableSection title="Legend" minHeight={120}>
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
            <StackableSection title="Facets" minHeight={120}>
              <PlotFacets
                data={data}
                facetKeys={sortedFacetKeys ?? []}
                continuousBins={facetContinuousBins}
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
            defaultOpen={
              !plotConfig.expand_by ||
              (plotConfig.expand_by && !plotConfig.color_by) ||
              plotConfig.color_by === "expansion"
            }
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

export default DataExplorerDensity1DPlot;
