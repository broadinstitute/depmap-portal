/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type { Config, Layout } from "plotly.js";
import { ModelConfigOut } from "@depmap/types";
import { ScreenTypeData } from "../hooks/usePredictiveInsightsData";

interface Props {
  configs: ModelConfigOut[];
  screenTypes: ScreenTypeData[];
}

function Chart({ configs, screenTypes, Plotly }: Props & { Plotly: any }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const traces = screenTypes.map((screenType) => {
      const y: Array<number | null> = [];
      const hoverText: string[] = [];

      configs.forEach((config) => {
        const fit = screenType.response.model_fits.find(
          (f) => f.config_name === config.model_config_name
        );

        y.push(fit ? fit.prediction_actual_correlation : null);

        const topFeatureLabels = fit
          ? fit.top_features
              .slice(0, 5)
              .map((f) => f.feature_label || f.feature_given_id)
              .join("<br>")
          : "No data";

        hoverText.push(
          `<b>${config.model_config_name}</b><br>Top features:<br>${topFeatureLabels}`
        );
      });

      return {
        type: "scatter" as const,
        mode: "lines+markers" as const,
        name: screenType.actualsDatasetName,
        x: configs.map((c) => c.model_config_name),
        y,
        text: hoverText,
        hovertemplate: "%{text}<extra></extra>",
        line: { color: screenType.color },
        marker: { color: screenType.color },
      };
    });

    const layout: Partial<Layout> = {
      height: 400,
      margin: { l: 60, r: 20, t: 20, b: 90 },
      xaxis: { tickangle: -30 },
      yaxis: { title: "R (observed vs. predicted)" },
      legend: { orientation: "h" },
    };

    const plotlyConfig: Partial<Config> = {
      responsive: true,
      displaylogo: false,
    };

    Plotly.react(ref.current, traces, layout, plotlyConfig);
  }, [configs, screenTypes, Plotly]);

  return <div ref={ref} />;
}

export default function AggregateScoresChart(props: Props) {
  const PlotlyLoader = usePlotlyLoader();

  return (
    <PlotlyLoader version="module">
      {(Plotly) => <Chart {...props} Plotly={Plotly} />}
    </PlotlyLoader>
  );
}
