/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef } from "react";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type { Config, Layout } from "plotly.js";
import { ModelConfigOut } from "@depmap/types";
import { ScreenTypeData } from "../hooks/usePredictiveInsightsData";
import { useFeatureLabels } from "../hooks/useFeatureLabels";
import { getFeatureLabel } from "../featureLabel";

interface Props {
  configs: ModelConfigOut[];
  screenTypes: ScreenTypeData[];
}

function Chart({
  configs,
  screenTypes,
  featureLabels,
  Plotly,
}: Props & { featureLabels: Record<string, string>; Plotly: any }) {
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
              .map((f) => getFeatureLabel(f, featureLabels))
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
  }, [configs, screenTypes, featureLabels, Plotly]);

  return <div ref={ref} />;
}

export default function AggregateScoresChart(props: Props) {
  const PlotlyLoader = usePlotlyLoader();

  const datasetIds = useMemo(
    () => [
      ...new Set(
        props.screenTypes.flatMap((screenType) =>
          screenType.response.model_fits.flatMap((fit) =>
            fit.top_features.map((f) => f.feature_dataset_id)
          )
        )
      ),
    ],
    [props.screenTypes]
  );
  const featureLabels = useFeatureLabels(datasetIds);

  return (
    <PlotlyLoader version="module">
      {(Plotly) => (
        <Chart {...props} featureLabels={featureLabels} Plotly={Plotly} />
      )}
    </PlotlyLoader>
  );
}
