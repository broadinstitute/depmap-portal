/* eslint-disable @typescript-eslint/naming-convention */
import React, { useMemo } from "react";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "../CompoundDoseViability.scss";
import { HeatmapFormattedData } from "../types";
import {
  sortHeatmapByViability,
  getVisibleSortedModelIdIndices,
  maskHeatmapData,
  getSelectedColumns,
  getSearchOptions,
  getCustomData,
} from "./heatmapPlotUtils";
import PrototypeBrushableHeatmap from "./doseViabilityHeatmap/components/PrototypeBrushableHeatmap";

interface HeatmapPlotSectionProps {
  isLoading: boolean;
  showUnselectedLines: boolean;
  compoundName: string;
  plotElement: ExtendedPlotType | null;
  heatmapFormattedData: HeatmapFormattedData | null;
  doseMin: number | null;
  doseMax: number | null;
  selectedModelIds: Set<string>;
  handleSetSelectedPlotModels: (models: Set<string>) => void;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
  displayNameModelIdMap: Map<string, string>;
  visibleZIndexes: number[];
}

function HeatmapPlotSection({
  isLoading,
  compoundName,
  heatmapFormattedData,
  doseMin,
  doseMax,
  selectedModelIds,
  handleSetSelectedPlotModels,
  handleSetPlotElement,
  plotElement,
  displayNameModelIdMap,
  visibleZIndexes,
  showUnselectedLines,
}: HeatmapPlotSectionProps) {
  // Sort data by ascending mean viability
  const sortedHeatmapFormattedData = useMemo(
    () => sortHeatmapByViability(heatmapFormattedData),
    [heatmapFormattedData]
  );

  // Keep track of visible column indexes so that columns can be turned on/off when specific
  // cell lines are selected, and the user has toggled "Show unselected lines" to OFF.
  const visibleSortedModelIdIndices = useMemo(
    () =>
      getVisibleSortedModelIdIndices(
        sortedHeatmapFormattedData,
        selectedModelIds,
        showUnselectedLines
      ),
    [sortedHeatmapFormattedData, selectedModelIds, showUnselectedLines]
  );

  // Mask Heatmap data that is not visible using the visibleSortedModelIdIndices to determine masked columns
  // and visibleZIndexes to further determine which z indexes should be masked due to Filter by Dose.
  const maskedHeatmapData = useMemo(
    () =>
      maskHeatmapData(
        sortedHeatmapFormattedData,
        visibleSortedModelIdIndices,
        visibleZIndexes
      ),
    [sortedHeatmapFormattedData, visibleSortedModelIdIndices, visibleZIndexes]
  );
  const selectedColumns = useMemo(
    () => getSelectedColumns(maskedHeatmapData, selectedModelIds),
    [selectedModelIds, maskedHeatmapData]
  );
  const searchOptions = useMemo(
    () => getSearchOptions(maskedHeatmapData, displayNameModelIdMap),
    [maskedHeatmapData, displayNameModelIdMap]
  );

  // This is somewhat of a hack for the purpose of hiding the tooltips of masked Heatmap columns.
  const customdata = useMemo(() => getCustomData(maskedHeatmapData), [
    maskedHeatmapData,
  ]);

  const handleSearch = (selection: {
    label: string;
    value: number;
    stringId?: string;
  }) => {
    if (selection.stringId) {
      handleSetSelectedPlotModels(new Set([selection.stringId]));
    }
  };

  const handleSelectColumnRange = (
    start: number,
    end: number,
    shiftKey: boolean
  ) => {
    let next: Set<string>;
    if (shiftKey) {
      next = new Set(selectedModelIds);
    } else {
      next = new Set();
    }
    for (let i = start; i <= end; i += 1) {
      if (maskedHeatmapData && maskedHeatmapData.modelIds[i]) {
        next.add(maskedHeatmapData.modelIds[i]!);
      }
    }
    handleSetSelectedPlotModels(next);
  };

  return (
    <div className={styles.PlotSection}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[
              PlotToolOptions.Search,
              PlotToolOptions.Download,
              PlotToolOptions.ZoomToSelection,
            ]}
            searchOptions={searchOptions}
            searchPlaceholder="Search for a cell line"
            onSearch={handleSearch}
            downloadImageOptions={{
              filename: `dose-viability-heatmap-${compoundName}`,
              width: 800,
              height: 600,
            }}
            onDownload={() => {}}
            zoomToSelectedSelections={selectedColumns}
            altContainerStyle={{ backgroundColor: "#7B8CB2" }}
            hideCSVDownload
          />
        )}
      </div>
      <div className={styles.plotArea}>
        {(!plotElement || isLoading) && (
          <div className={styles.plotSpinnerContainer}>
            <PlotSpinner height="100%" />
          </div>
        )}
        {maskedHeatmapData && doseMin && doseMax && !isLoading && (
          <div className={styles.heatmapContainer}>
            <PrototypeBrushableHeatmap
              data={{
                ...maskedHeatmapData,
                x: maskedHeatmapData.x,
                y: maskedHeatmapData.y,
                z: maskedHeatmapData.z,
                customdata,
              }}
              onLoad={handleSetPlotElement}
              xAxisTitle="Cell Lines"
              yAxisTitle={`${compoundName} Dose (μM)`}
              legendTitle="Viability"
              hovertemplate="%{customdata}<extra></extra>"
              selectedColumns={selectedColumns}
              onClearSelection={() => handleSetSelectedPlotModels(new Set())}
              onSelectColumnRange={handleSelectColumnRange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(HeatmapPlotSection);
