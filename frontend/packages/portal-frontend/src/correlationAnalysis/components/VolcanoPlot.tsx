import React, { useEffect, useRef } from "react";
import Plotly, {
  Layout,
  Config,
  PlotMouseEvent,
  PlotlyHTMLElement,
  PlotData,
} from "plotly.js";
import { formatLayout } from "../utilities/volcanoPlotUtils";
import { VolcanoPlotPoint } from "../models/VolcanoPlot";
import styles from "../styles/VolcanoPlot.scss";

type VolcanoPlotProps = {
  volcanoTrace: Partial<PlotData>[];
  onPointClick: (point: VolcanoPlotPoint, keyModifier: boolean) => void;
};

function VolcanoPlot({ volcanoTrace, onPointClick }: VolcanoPlotProps) {
  const plotRef = useRef<HTMLDivElement & PlotlyHTMLElement>(null);

  useEffect(() => {
    const plot = plotRef.current;

    if (!plot) return undefined;

    const layout: Partial<Layout> = formatLayout();

    const config: Partial<Config> = {
      responsive: true,
    };

    Plotly.react(plot, volcanoTrace, layout, config);

    // Handle point click
    const handleClick = (event: PlotMouseEvent) => {
      const point = event.points?.[0];
      const keyModifier =
        event.event.ctrlKey || event.event.metaKey || event.event.shiftKey;
      const clickedDatum = {
        x: point.x,
        y: point.y,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        text: point.text, // Unclear why PlotDatum type doesn't have 'text' property when it seems to exist
        pointIndex: point.pointIndex,
      };
      if (clickedDatum && onPointClick) {
        onPointClick(clickedDatum as VolcanoPlotPoint, keyModifier);
      }
    };

    plot.on("plotly_click", handleClick);

    // cleanup listeners
    return () => {
      plot?.removeAllListeners("plotly_click");
    };
  }, [volcanoTrace, onPointClick]);

  return <div className={styles.VolcanoPlot} ref={plotRef} />;
}

export default VolcanoPlot;
