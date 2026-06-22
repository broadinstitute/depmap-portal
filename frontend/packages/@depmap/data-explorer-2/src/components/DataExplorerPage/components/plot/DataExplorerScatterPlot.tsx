import React, { useEffect, useMemo, useState } from "react";
import { isPortal } from "@depmap/globals";
import {
  DataExplorerContextV2,
  DataExplorerExpansion,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  EntityRefSet,
  LinRegInfo,
  entityRefKey,
  singleRef,
} from "@depmap/types";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import type ExtendedPlotType from "../../ExtendedPlotType";
import SpinnerOverlay from "./SpinnerOverlay";
import useScatterPlotData from "./prototype/useScatterPlotData";
import PrototypeScatterPlot from "./prototype/PrototypeScatterPlot";
import SmallMultiplesScatter from "./prototype/SmallMultiplesScatter";
import { findCategoricalSlice } from "./prototype/plotUtils";
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
}: Props) {
  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const {
    selection,
    selectedPoints,
    handleClickPoint,
    handleMultiselect,
    setSelection,
    clearSelection,
  } = useSelection(data);

  // Expanded plots (the response carries an expansion) get a different
  // selection panel: ExpandedPlotSelections lists (index, expansion)
  // pairs instead of collapsing them to index entities. Structural read
  // on the expansion shape, matching the idiom in plotUtils / useSelection.
  const isExpanded =
    ((data as { expansions?: DataExplorerExpansion[] } | null)?.expansions
      ?.length ?? 0) > 0;

  // Small multiples = the 2D realization of group_by. Unlike the 1D plots,
  // scatter does NOT fall back to color_by when group_by is unset: auto-
  // faceting a colored scatter by its own color dimension would explode into
  // per-category panels. So facet only on an *explicit* group_by. The facet
  // key per point comes from the same reader color_by uses.
  const facetKeys = useMemo(() => {
    if (!plotConfig.group_by) {
      return null;
    }
    const slice = findCategoricalSlice(data, plotConfig.group_by);
    return (
      slice?.values.map((v) => (v == null ? "(no value)" : String(v))) ?? null
    );
  }, [data, plotConfig.group_by]);
  const isFaceted = Boolean(facetKeys);
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
    formattedData,
    continuousBins,
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    colorMap,
    legendForDownload,
    pointVisibility,
    regressionLines,
    regressionLinesByFacet,
    showIdentityLine,
  } = useScatterPlotData(
    data,
    plotConfig,
    linreg_by_group,
    palette,
    canShowIdentityLine
  );

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

    const validKeys = new Set<string>();
    const expansions = (data as { expansions?: { ids: string[] }[] })
      .expansions;
    const expansionIds = expansions?.[0]?.ids;
    for (let i = 0; i < data.index_ids.length; i += 1) {
      if (expansionIds) {
        validKeys.add(`p\x1f${data.index_ids[i]}\x1f${expansionIds[i]}`);
      } else {
        validKeys.add(`s\x1f${data.index_ids[i]}`);
      }
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
  }, [data, setSelection]);

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
                facetKeys={facetKeys ?? []}
                placeholderEmptyFacets={Boolean(plotConfig.expand_by?.length)}
                showIdentityLine={showIdentityLine}
                regressionLinesByFacet={regressionLinesByFacet}
                onLoad={setPlotElement}
                onClickPoint={handleClickPoint}
                onMultiselect={handleMultiselect}
                selectedPoints={selectedPoints}
                onClickResetSelection={clearSelection}
                pointSize={pointSize}
                pointOpacity={pointOpacity}
                outlineWidth={outlineWidth}
                palette={palette}
                xAxisFontSize={xAxisFontSize}
                yAxisFontSize={yAxisFontSize}
              />
            ) : (
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
              legendKeysWithNoData={legendKeysWithNoData}
              onClickLegendItem={onClickLegendItem}
              handleClickShowAll={handleClickShowAll}
              handleClickHideAll={handleClickHideAll}
            />
          </StackableSection>
          <StackableSection title="Plot Selections" minHeight={256}>
            {isExpanded ? (
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
                  // pairs — wrap as single refs. If/when contexts can
                  // describe (index, expansion) pairs, this is the place
                  // to grow.
                  setSelection(
                    new EntityRefSet([...newSelectedIds].map(singleRef))
                  );
                  plotElement?.annotateSelected();
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
