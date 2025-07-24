import React, { useRef, useEffect } from "react";
import type { PlotlyType } from "src/plot/components/PlotlyLoader";
import { DO_LOG2_PLOT_DATA } from "src/compound/heatmapTab/heatmapPlotUtils";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import type { Data as PlotlyData } from "plotly.js";
import { StaticHeatmapProps } from "./types";
import usePlotResizer from "../../hooks/usePlotResizer";

export function getStaticPlotlyConfig(
  data: StaticHeatmapProps["data"],
  legendTitle: string,
  hovertemplate: string | string[] | undefined
) {
  const plotlyTileData: PlotlyData = {
    type: "heatmap",
    ...data,
    colorscale: "YlOrRd",
    zmin: DO_LOG2_PLOT_DATA ? -2 : 0,
    zmax: DO_LOG2_PLOT_DATA ? 0 : 1,
    colorbar: {
      x: 0.1,
      y: -0.35,
      len: 0.8,
      thickness: 8,
      ypad: 0,
      xanchor: "left",
      ...({
        orientation: "h",
        title: {
          text: legendTitle,
          side: "bottom",
        },
      } as object),
    },
    hovertemplate,
    xaxis: "x",
    yaxis: "y",
    xgap: 0.15,
    ygap: 0.15,
  };

  return plotlyTileData;
}

export function getStaticLayout(
  xAxisTitle: string | undefined,
  yAxisTitle: string
) {
  return {
    height: 260,
    title: {
      text: xAxisTitle ?? "Cell Lines",
      font: {
        family: "Lato",
        size: 14,
      },
    },
    margin: { t: 20, l: 2, r: 10, b: 80 },
    dragmode: false as
      | false
      | "zoom"
      | "pan"
      | "select"
      | "lasso"
      | "orbit"
      | "turntable"
      | undefined,
    xaxis: { visible: false },
    yaxis: {
      type: "category" as const,
      automargin: true,
      autorange: true,
      title: { text: yAxisTitle },
      visible: false,
    },
  };
}

export default function StaticBrushableHeatmap({
  data,
  xAxisTitle = undefined,
  yAxisTitle,
  legendTitle,
  hovertemplate = undefined,
  onLoad = () => {},
  Plotly,
}: StaticHeatmapProps & { Plotly: PlotlyType }) {
  const ref = useRef<ExtendedPlotType>(null);

  usePlotResizer(Plotly, ref);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    const plotlyData = [
      getStaticPlotlyConfig(data, legendTitle, hovertemplate),
    ];
    const layout = getStaticLayout(xAxisTitle, yAxisTitle);

    Plotly.react(plot, plotlyData, layout, {
      staticPlot: true,
      displayModeBar: false,
    });
  }, [data, Plotly, hovertemplate, legendTitle, xAxisTitle, yAxisTitle]);

  return <div ref={ref} />;
}
