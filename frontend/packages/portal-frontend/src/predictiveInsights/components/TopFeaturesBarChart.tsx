/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type { Config, Layout } from "plotly.js";

export interface TopFeatureSegment {
  modelName: string;
  value: number;
  color: string;
  datasetNames: string[];
}

export interface TopFeatureBarDatum {
  label: string;
  total: number;
  segments: TopFeatureSegment[];
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
    // Plotly draws horizontal bars bottom-to-top, so reverse to get the most
    // important feature at the top of the chart.
    const ordered = [...features].reverse();

    // One trace per model so the bars are stacked and share a legend.
    const modelNames: string[] = [];
    const colors: Record<string, string> = {};
    features.forEach((f) =>
      f.segments.forEach((s) => {
        if (!modelNames.includes(s.modelName)) {
          modelNames.push(s.modelName);
          colors[s.modelName] = s.color;
        }
      })
    );

    const traces = modelNames.map((modelName) => {
      const segs = ordered.map((f) =>
        f.segments.find((s) => s.modelName === modelName)
      );

      return {
        type: "bar" as const,
        orientation: "h" as const,
        name: modelName,
        x: segs.map((s) => (s ? s.value : 0)),
        y: ordered.map((f) => f.label),
        marker: { color: colors[modelName] },
        customdata: segs.map((s) => (s ? s.datasetNames.join(", ") : "")),
        hovertemplate: `%{y}<br>Model: ${modelName}<br>Normalized importance: %{x:.4f}<br>Dataset: %{customdata}<extra></extra>`,
      };
    });

    const layout: Partial<Layout> = {
      height: 400,
      barmode: "stack",
      margin: { r: 20, t: 20, b: 40 },
      xaxis: { title: "Normalized feature importance" },
      yaxis: { automargin: true, tickfont: { size: 10 } },
    };

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
    };

    Plotly.react(ref.current, traces, layout, config);
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
