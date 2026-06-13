import React, { useEffect, useMemo, useState } from "react";
import { useDataExplorerSettings } from "../../../../contexts/DataExplorerSettingsContext";
import { isPortal } from "@depmap/globals";
import SpinnerOverlay from "./SpinnerOverlay";
import type ExtendedPlotType from "../../ExtendedPlotType";
import {
  DataExplorerContextV2,
  DataExplorerExpansion,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  EntityRefSet,
  entityRefKey,
  singleRef,
} from "@depmap/types";
import useDensity1DPlotData from "./prototype/useDensity1DPlotData";
import PrototypeDensity1D from "./prototype/PrototypeDensity1D";
import DataExplorerPlotControls from "./DataExplorerPlotControls";
import SectionStack, { StackableSection } from "../SectionStack";
import PlotLegend from "./PlotLegend";
import PlotSelections from "./PlotSelections";
import ExpandedPlotSelections from "./ExpandedPlotSelections";
import GeneTea from "./integrations/GeneTea";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import useSelection from "../../hooks/useSelection";
import styles from "../../styles/DataExplorer2.scss";

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
}

function DataExplorerDensity1DPlot({
  data,
  isLoading,
  plotConfig,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickColorByContext,
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
    colorData,
    groupData,
    legendKeysWithNoData,
    sortedGroupKeys,
    legendState,
    colorMap,
    legendDisplayNames,
    legendTitle,
    pointVisibility,
  } = useDensity1DPlotData(data, plotConfig, palette);

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

    const validKeys = new Set<string>();
    const expansions = (data as { expansions?: { ids: string[] }[] }).expansions;
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
          />
        </div>
        <div className={styles.plot}>
          {showSpinner && <SpinnerOverlay />}
          {formattedData && (
            <PrototypeDensity1D
              data={formattedData}
              xKey="x"
              colorMap={colorMap}
              colorData={colorData}
              groupData={groupData}
              groupKeys={sortedGroupKeys}
              continuousColorKey="contColorData"
              legendDisplayNames={legendDisplayNames}
              legendTitle={legendTitle}
              pointVisibility={pointVisibility || undefined}
              useSemiOpaqueViolins={!plotConfig.hide_points}
              placeholderEmptyTracks={Boolean(plotConfig.expand_by?.length)}
              hoverTextKey="hoverText"
              annotationTextKey="annotationText"
              height="auto"
              onLoad={setPlotElement}
              onClickPoint={handleClickPoint}
              onMultiselect={handleMultiselect}
              selectedPoints={selectedPoints}
              onClickResetSelection={clearSelection}
              hiddenLegendValues={hiddenLegendValues}
              pointSize={pointSize}
              pointOpacity={pointOpacity}
              outlineWidth={outlineWidth}
              palette={palette}
              xAxisFontSize={xAxisFontSize}
              yAxisFontSize={yAxisFontSize}
            />
          )}
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
                  const newSelectedIds = await promptForSelectionFromContext(data!);

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

export default DataExplorerDensity1DPlot;
