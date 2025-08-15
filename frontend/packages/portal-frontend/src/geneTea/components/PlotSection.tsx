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
import Heatmap from "../plots/Heatmap";

interface PlotSectionProps {
  isLoading: boolean;
  plotElement: ExtendedPlotType | null;
  heatmapFormattedData: HeatmapFormattedData | null;
  heatmapXAxisLabel: string;
  barChartData: BarChartFormattedData | null;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
  handleClearSelection: () => void;
}

function PlotSection({
  heatmapXAxisLabel,
  isLoading,
  heatmapFormattedData,
  barChartData,
  handleSetPlotElement,
  handleClearSelection,
  plotElement,
}: PlotSectionProps) {
  console.log(isLoading);
  return (
    <div className={styles.PlotSection}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[PlotToolOptions.Search, PlotToolOptions.Download]}
            searchOptions={null}
            searchPlaceholder="Search for a cell line"
            onSearch={() => {}}
            downloadImageOptions={{
              filename: `genetea-heatmap`,
              width: 800,
              height: 600,
            }}
            onDownload={() => {}}
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
            <Heatmap
              heatmapData={heatmapFormattedData}
              barChartData={barChartData}
              // onLoad={handleSetPlotElement}
              heatmapXAxisTitle={heatmapXAxisLabel}
              xAxisTitle=""
              yAxisTitle={``}
              legendTitle={""}
              hovertemplate="%{customdata}<extra></extra>"
              onClearSelection={() => handleClearSelection()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PlotSection);
