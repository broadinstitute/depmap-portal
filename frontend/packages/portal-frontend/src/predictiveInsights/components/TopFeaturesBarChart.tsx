/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type { Config, Layout } from "plotly.js";

export interface TopFeatureBarDatum {
  label: string;
  importance: number;
  modelName: string;
  color: string;
}

interface Props {
  features: TopFeatureBarDatum[];
}

function Chart({ features, Plotly }: Props & { Plotly: any }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    // Plotly draws horizontal bars bottom-to-top, so reverse to get the most
    // important feature at the top of the chart.
    const ordered = [...features].reverse();

    const trace = {
      type: "bar" as const,
      orientation: "h" as const,
      x: ordered.map((f) => f.importance),
      y: ordered.map((f) => f.label),
      marker: { color: ordered.map((f) => f.color) },
      text: ordered.map((f) => f.modelName),
      hovertemplate:
        "%{y}<br>Importance: %{x:.3f}<br>Model: %{text}<extra></extra>",
    };

    const layout: Partial<Layout> = {
      height: 400,
      margin: { l: 280, r: 20, t: 20, b: 40 },
      xaxis: { title: "Relative importance" },
      yaxis: { automargin: true, tickfont: { size: 10 } },
    };

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
    };

    Plotly.react(ref.current, [trace], layout, config);
  }, [features, Plotly]);

  return <div ref={ref} />;
}

export default function TopFeaturesBarChart(props: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) => <Chart {...props} Plotly={Plotly} />}
    </PlotlyLoader>
  );
}
