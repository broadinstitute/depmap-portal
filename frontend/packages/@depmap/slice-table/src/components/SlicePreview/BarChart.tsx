import React, { useEffect, useRef } from "react";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type { Config, Layout, PlotData, PlotlyHTMLElement } from "plotly.js";

type Data = Record<string, any>;

interface Props {
  data: Data;
  xAxisTitle: string;
  useLogScale?: boolean;
}

type ExtendedPlotType = HTMLDivElement &
  PlotlyHTMLElement & {
    data: PlotData[];
    layout: Layout;
    config: Config;
  };

function PrototypeBarChart({
  data,
  xAxisTitle,
  useLogScale = false,
  onLoad = () => {},
  Plotly,
}: Props & { onLoad?: (el: ExtendedPlotType) => void; Plotly: any }) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  useEffect(() => {
    const plot = ref.current;

    const { x, y } = data;

    const plotlyData = [
      {
        type: "bar" as const,
        x,
        y,
        hovertemplate: `${xAxisTitle}: %{x}<br>count: %{y:,}<extra></extra>`,
      },
    ];

    const layout: Partial<Layout> = {
      height: 500,
      xaxis: {
        type: "category",
        title: xAxisTitle,
      },
      yaxis: {
        type: useLogScale ? "log" : "linear",
        title: "count",
      },
    };

    const config: Partial<Config> = {
      responsive: true,
      edits: { annotationTail: true },
      displaylogo: false,
      modeBarButtonsToRemove: ["select2d", "lasso2d"],
    };

    Plotly.react(plot!, plotlyData, layout, config);
  }, [data, xAxisTitle, useLogScale, Plotly]);

  return <div ref={ref} />;
}

export default function LazyBarChart({ data, ...otherProps }: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) =>
        data ? (
          <PrototypeBarChart data={data} Plotly={Plotly} {...otherProps} />
        ) : null
      }
    </PlotlyLoader>
  );
}
