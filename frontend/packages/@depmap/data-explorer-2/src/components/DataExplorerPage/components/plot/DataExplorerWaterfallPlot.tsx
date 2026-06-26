import React, { useEffect, useMemo, useState } from "react";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { isPortal } from "@depmap/globals";
import SpinnerOverlay from "./SpinnerOverlay";
import type ExtendedPlotType from "../../ExtendedPlotType";
import {
  DataExplorerContextV2,
  DataExplorerExpansion,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  entityRefKey,
} from "@depmap/types";
import useWaterfallPlotData from "./prototype/useWaterfallPlotData";
import PrototypeScatterPlot from "./prototype/PrototypeScatterPlot";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import PlotLegend from "./PlotLegend";
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
  plotConfig: DataExplorerPlotConfig;
  onClickColorByContext: (context: DataExplorerContextV2) => void;
  onClickSaveSelectionAsContext: (
    dimension_type: string,
    selectedIds: Set<string>
  ) => void;
  onClickVisualizeSelected: (
    e: React.MouseEvent,
    selectedIds: Set<string>
  ) => void;
}

function DataExplorerWaterfallPlot({
  data,
  isLoading,
  plotConfig,
  onClickColorByContext,
  onClickSaveSelectionAsContext,
  onClickVisualizeSelected,
}: Props) {
  // Expanded plots (group_by "expansion") are the one and only trigger for
  // confining selection to a single group.
  const enforceSingleGroupSelection = plotConfig.group_by === "expansion";
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
  } = useSelection(data, plotConfig.group_by);

  // Expanded plots (the response carries an expansion) get a different
  // selection panel: ExpandedPlotSelections lists (index, expansion)
  // pairs instead of collapsing them to index entities. Structural read
  // on the expansion shape, matching the idiom in plotUtils / useSelection.
  const isExpanded =
    ((data as { expansions?: DataExplorerExpansion[] } | null)?.expansions
      ?.length ?? 0) > 0;

  // Panel-follows-grain: the pair panel (ExpandedPlotSelections) only makes
  // sense when selection is pair-grained. Under group_by === "expansion"
  // selection collapses to models, so the pair panel would match nothing —
  // show the model PlotSelections instead (its Visualize / Save-as-context
  // operations are meaningful for models). Mirrors `pairGrained` in
  // useSelection.
  const isPairGrained = isExpanded && plotConfig.group_by !== "expansion";
  const [showSpinner, setShowSpinner] = useState(isLoading);
  const { plotStyles } = useDataExplorerSettings();
  const {
    pointSize,
    pointOpacity,
    outlineWidth,
    palette,
    xAxisFontSize,
    yAxisFontSize,
  } = plotStyles;

  const {
    sortedLegendKeys,
    formattedData,
    continuousBins,
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    colorMap,
    legendForDownload,
    pointVisibility,
    selectionRegions,
  } = useWaterfallPlotData(data, plotConfig, palette);

  const {
    hiddenLegendValues,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  } = legendState;

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
    // selection (group_by === "expansion") would be measured against pair keys
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
          {formattedData && (
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
              showIdentityLine={false}
              onClickResetSelection={clearSelection}
              legendForDownload={legendForDownload}
              enforceSingleGroupSelection={enforceSingleGroupSelection}
              selectionRegions={selectionRegions}
              selectionAxis="x"
              pointsToAnnotate={pointsToAnnotate}
              selectionCount={selection?.size ?? 0}
              pointSize={pointSize}
              pointOpacity={pointOpacity}
              outlineWidth={outlineWidth}
              customHoverinfo="y+text"
              hideXAxisGrid
              hideXAxis={Boolean(data?.metadata?.color_property)}
              palette={palette}
              xAxisFontSize={xAxisFontSize}
              yAxisFontSize={yAxisFontSize}
            />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <SectionStack>
          <StackableSection title="Legend" minHeight={132}>
            <PlotLegend
              data={data}
              colorMap={colorMap}
              sortedLegendKeys={sortedLegendKeys}
              continuousBins={continuousBins}
              hiddenLegendValues={hiddenLegendValues}
              legendKeysWithNoData={legendKeysWithNoData}
              onClickLegendItem={onClickLegendItem}
              handleClickShowAll={handleClickShowAll}
              handleClickHideAll={handleClickHideAll}
            />
          </StackableSection>
          <StackableSection title="Plot Selections" minHeight={256}>
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

export default DataExplorerWaterfallPlot;
