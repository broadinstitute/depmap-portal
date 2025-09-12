/* eslint-disable @typescript-eslint/naming-convention */
import React, { useMemo } from "react";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "../styles/GeneTea.scss";
import {
  BarChartFormattedData,
  HeatmapFormattedData,
} from "@depmap/types/src/experimental_genetea";
import HeatmapBarChart from "../plots/HeatmapBarChart";
import { getSelectedColumns } from "../utils";
import { useGeneTeaContext } from "../context/GeneTeaContext";

interface PlotSectionProps {
  isLoading: boolean;
  plotElement: ExtendedPlotType | null;
  heatmapFormattedData: HeatmapFormattedData | null;
  heatmapXAxisLabel: string;
  barChartData: BarChartFormattedData | null;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
}

function PlotSection({
  heatmapXAxisLabel,
  isLoading,
  heatmapFormattedData,
  barChartData,
  handleSetPlotElement,
  plotElement,
}: PlotSectionProps) {
  const {
    selectedPlotGenes,
    handleSetPlotSelectedGenes,
    handleClickSavePlotSelectionAsContext,
    handleClearPlotSelection,
    maxTopTerms,
    doGroupTerms,
  } = useGeneTeaContext();

  const handleSelectColumnRange = (
    start: number,
    end: number,
    shiftKey: boolean
  ) => {
    const newlySelected = new Set<string>();
    for (let i = start; i <= end; i += 1) {
      if (heatmapFormattedData && heatmapFormattedData.x[i]) {
        newlySelected.add(heatmapFormattedData.x[i]!);
      }
    }
    handleSetPlotSelectedGenes(newlySelected, shiftKey);
  };

  const selectedColumns = useMemo(
    () =>
      heatmapFormattedData
        ? getSelectedColumns(heatmapFormattedData, selectedPlotGenes)
        : new Set([]),
    [selectedPlotGenes, heatmapFormattedData]
  );

  const handleSearch = (selection: {
    label: string;
    value: number;
    stringId?: string;
  }) => {
    if (selection.stringId) {
      // The shiftKey parameter is false because you cannot hold down the shift key and search to add
      // to your selection.
      const shiftKey = false;
      handleSetPlotSelectedGenes(new Set([selection.stringId]), shiftKey);
    }
  };

  return (
    <div className={styles.PlotSection}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[
              PlotToolOptions.ZoomToSelection,
              PlotToolOptions.MakeContext,
              PlotToolOptions.Download,
              PlotToolOptions.Search,
            ]}
            onSearch={handleSearch}
            searchOptions={
              heatmapFormattedData?.x.map((gene: string, index: number) => {
                const option = {
                  label: gene,
                  value: index,
                  stringId: gene,
                };
                return option;
              }) || null
            }
            searchPlaceholder="Search for a gene"
            downloadImageOptions={{
              filename: `genetea-heatmap-bar-plot`,
              width: 800,
              height: 600,
            }}
            onDownload={() => {}}
            onMakeContext={
              selectedPlotGenes.size > 0
                ? handleClickSavePlotSelectionAsContext
                : undefined
            }
            zoomToSelectedSelections={selectedColumns}
            altContainerStyle={{ backgroundColor: "#7B8CB2" }}
            hideCSVDownload
          />
        )}
      </div>
      <div className={styles.plotArea}>
        {isLoading && (
          <div className={styles.plotSpinnerContainer}>
            <PlotSpinner height="100%" />
          </div>
        )}
        {heatmapFormattedData && barChartData && !isLoading && (
          <div className={styles.heatmapContainer}>
            <HeatmapBarChart
              plotTitle={`Top ${maxTopTerms} Enriched ${
                doGroupTerms ? "Term Groups" : "Terms"
              } from GeneTEA`}
              barChartXAxisTitle="-log10(FDR)"
              heatmapData={heatmapFormattedData}
              barChartData={barChartData}
              onLoad={handleSetPlotElement}
              heatmapXAxisTitle={heatmapXAxisLabel}
              legendTitle={""}
              hovertemplate="%{customdata}<extra></extra>"
              onClearSelection={() => handleClearPlotSelection()}
              onSelectColumnRange={handleSelectColumnRange}
              selectedColumns={selectedColumns}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PlotSection);
