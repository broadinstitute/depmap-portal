import React, { useEffect, useRef } from "react";
import Plotly, {
  Layout,
  Config,
  PlotMouseEvent,
  PlotlyHTMLElement,
} from "plotly.js";
import {
  formatLayout,
  formatVolcanoTrace,
} from "../utilities/volcanoPlotUtils";
import { VolcanoPlotData, VolcanoPlotPoint } from "../models/VolcanoPlot";

type VolcanoPlotProps = {
  data: VolcanoPlotData[];
  onPointClick?: (point: VolcanoPlotPoint, keyModifier: boolean) => void;
};

function VolcanoPlot({ data, onPointClick }: VolcanoPlotProps) {
  const plotRef = useRef<HTMLDivElement & PlotlyHTMLElement>(null);

  useEffect(() => {
    if (!plotRef.current) return;

    const volcanoTrace = formatVolcanoTrace(data);

    const layout: Partial<Layout> = formatLayout();

    const config: Partial<Config> = {
      responsive: true,
      // hides hover widget toolbar
      displayModeBar: false,
    };

    Plotly.react(plotRef.current, volcanoTrace, layout, config);

    // Handle point click
    const handleClick = (event: PlotMouseEvent) => {
      const point = event.points?.[0];
      const keyModifier =
        event.event.ctrlKey || event.event.metaKey || event.event.shiftKey;
      const clickedDatum = {
        x: point.x,
        y: point.y,
        text: point.text,
        pointIndex: point.pointIndex,
      };
      if (clickedDatum && onPointClick) {
        onPointClick(clickedDatum as VolcanoPlotPoint, keyModifier);
      }
    };

    plotRef.current.on("plotly_click", handleClick);

    // cleanup listeners
    return () => {
      console.log("Cleanup and unmount plot");
      plotRef.current?.removeAllListeners("plotly_click");
    };
  }, [data, onPointClick]);

  return <div ref={plotRef} />;
}

export default VolcanoPlot;
