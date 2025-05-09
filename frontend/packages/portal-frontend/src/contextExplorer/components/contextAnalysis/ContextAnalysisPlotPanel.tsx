/* eslint-disable @typescript-eslint/naming-convention */
import React, { useMemo } from "react";
import ContextAnalysisScatterPlot from "./ContextAnalysisScatterPlot";
import {
  ContextAnalysisPlotData,
  ContextAnalysisPlotType,
} from "../../models/types";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";

interface Props {
  data: ContextAnalysisPlotData | null;
  plot: ExtendedPlotType | null;
  plotType: ContextAnalysisPlotType;
  pointVisibility: boolean[];
  handleClickPoint: (pointIndex: number) => void;
  handleSetSelectedLabels: (labels: Set<string> | null) => void;
  handleSetPlotElement: (element: any) => void;
  selectedPlotLabels: Set<string> | null;
  colorScale: string[][] | undefined;
  isLoading: boolean;
  entityType: string;
  showYEqualXLine: boolean;
}
function ContextAnalysisPlotPanel({
  data,
  plot,
  plotType,
  pointVisibility,
  handleClickPoint,
  handleSetSelectedLabels,
  handleSetPlotElement,
  selectedPlotLabels,
  colorScale,
  isLoading,
  entityType,
  showYEqualXLine,
}: Props) {
  const formattedPlotData = useMemo(() => {
    if (data) {
      const plotTypeData =
        plotType === ContextAnalysisPlotType.inVsOut
          ? data?.inVsOut
          : data?.tTest;
      return {
        x: plotTypeData.x.values,
        y: plotTypeData.y.values,
        xLabel: plotTypeData.x.axisLabel,
        yLabel: plotTypeData.y.axisLabel,
        hoverText:
          entityType === "gene"
            ? data.indexLabels.map((label: string) => {
                return [`<b>${label}</b>`].join("<br>");
              })
            : data.indexLabels.map((label: string) => {
                return [`<b>${label.split("(")[0].trim()}</b>`].join("<br>");
              }),
      };
    }

    if (isLoading && !data) {
      return null;
    }
    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
      hoverText: "",
    };
  }, [data, plotType, isLoading, entityType]);

  return (
    <div className={styles.scatterPlotContainer}>
      {plot && data && (
        <div>
          <PlotControls
            plot={plot}
            enabledTools={[PlotToolOptions.Zoom, PlotToolOptions.Pan]}
            searchOptions={[]}
            searchPlaceholder=""
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onSearch={(selection: { label: string; value: number }) => {
              /* do nothing */
            }}
            onDownload={() => {
              /* do nothing */
            }}
          />
        </div>
      )}
      <div>
        <ContextAnalysisScatterPlot
          data={formattedPlotData}
          indexLabels={data?.indexLabels || []}
          colorVariable={data?.selectivityVal || []}
          handleClickPoint={handleClickPoint}
          handleSetSelectedLabels={handleSetSelectedLabels}
          handleSetPlotElement={handleSetPlotElement}
          selectedPlotLabels={selectedPlotLabels}
          pointVisibility={pointVisibility}
          colorScale={colorScale}
          showYEqualXLine={showYEqualXLine}
        />
      </div>
    </div>
  );
}

export default React.memo(ContextAnalysisPlotPanel);
