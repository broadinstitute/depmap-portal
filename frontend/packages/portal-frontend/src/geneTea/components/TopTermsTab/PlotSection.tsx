/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useMemo } from "react";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "../../styles/GeneTea.scss";
import {
  BarChartFormattedData,
  HeatmapFormattedData,
} from "@depmap/types/src/experimental_genetea";
import { useGeneTeaFiltersContext } from "src/geneTea/context/GeneTeaFiltersContext";
import { useTopTermsContext } from "src/geneTea/context/TopTermsContext";

import HeatmapBarChart from "src/geneTea/plots/HeatmapBarChart";

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
    maxTopTerms,
    doGroupTerms,
  } = useGeneTeaFiltersContext();

  const {
    handleClickSavePlotSelectionAsContext,
    handleClearPlotSelection,
  } = useTopTermsContext();

  // Memoize zmax and zmin calculations to avoid recalculating on every render. Some reduce shananigans becayse arr can
  // get VERY large.
  const zmax = useMemo(() => {
    if (!heatmapFormattedData) return undefined;
    const arr = (heatmapFormattedData.z as number[]).filter(
      (v) => typeof v === "number" && !isNaN(v)
    );
    if (arr.length === 0) return undefined;
    const max = arr.reduce((a, b) => Math.max(a, b), -Infinity);
    return max === -Infinity ? undefined : max;
  }, [heatmapFormattedData]);

  const zmin = useMemo(() => {
    if (!heatmapFormattedData) return undefined;
    const arr = (heatmapFormattedData.z as number[]).filter(
      (v) => typeof v === "number" && !isNaN(v)
    );
    if (arr.length === 0) return undefined;
    const min = arr.reduce((a, b) => Math.min(a, b), Infinity);
    return min === Infinity ? undefined : min;
  }, [heatmapFormattedData]);

  const getSelectedColumns = useCallback(
    (heatmapData: HeatmapFormattedData, selectedGenes: Set<string>) => {
      const uniqueXs = new Set(heatmapData.x);
      const out = new Set<number>();
      [...uniqueXs].forEach((x: string, index: number) => {
        if (x !== null && selectedGenes.has(x)) {
          out.add(index);
        }
      });
      return out;
    },
    []
  );

  const handleSelectColumnRange = useCallback(
    (start: number, end: number, shiftKey: boolean) => {
      const newlySelected = new Set<string>();
      for (let i = start; i <= end; i += 1) {
        if (heatmapFormattedData && heatmapFormattedData.x[i]) {
          const selectableColumnLength = [...new Set(heatmapFormattedData.y)]
            .length;
          if (i < selectableColumnLength) {
            newlySelected.add(heatmapFormattedData.x[i]!);
          }
        }
      }
      handleSetPlotSelectedGenes(newlySelected, shiftKey);
    },
    [heatmapFormattedData, handleSetPlotSelectedGenes]
  );

  // Memoize selectedColumns as a sorted Set for stable reference
  const selectedColumns = useMemo(() => {
    if (!heatmapFormattedData) return new Set<number>();
    const selected = getSelectedColumns(
      heatmapFormattedData,
      selectedPlotGenes
    );
    // Convert Set to sorted array, then back to Set for stable reference
    return new Set(Array.from(selected).sort());
  }, [selectedPlotGenes, heatmapFormattedData]);

  const handleSearch = useCallback(
    (selection: { label: string; value: number; stringId?: string }) => {
      if (selection.stringId) {
        // The shiftKey parameter is false because you cannot hold down the shift key and search to add
        // to your selection.
        const shiftKey = false;
        handleSetPlotSelectedGenes(new Set([selection.stringId]), shiftKey);
      }
    },
    [handleSetPlotSelectedGenes]
  );

  const searchOpts = useMemo(
    () =>
      heatmapFormattedData?.x.map((gene: string, index: number) => {
        const option = {
          label: gene,
          value: index,
          stringId: gene,
        };
        return option;
      }) || null,
    [heatmapFormattedData]
  );

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
              PlotToolOptions.ResetSelection,
            ]}
            onSearch={handleSearch}
            searchOptions={searchOpts}
            searchPlaceholder="Search for a gene"
            downloadImageOptions={{
              filename: `genetea-heatmap-bar-plot`,
              width: 800,
              height: 600,
            }}
            onDownload={() => {}}
            onClearSelection={
              selectedPlotGenes.size > 0 ? handleClearPlotSelection : undefined
            }
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
              onClearSelection={handleClearPlotSelection}
              onSelectColumnRange={handleSelectColumnRange}
              selectedColumns={selectedColumns}
              zmax={zmax}
              zmin={zmin}
              doGroupTerms={doGroupTerms}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PlotSection);
