import { Layout, Shape } from "plotly.js";
import React, { useMemo, useRef, useEffect } from "react";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface DistributionPlotProps {
  values: number[];
  color: string;
  yAxisAtZero?: boolean;
  onLoad?: (plot: ExtendedPlotType) => void;
}

type DistributionPlotPropsWithPlotly = DistributionPlotProps & {
  Plotly: PlotlyType;
};

function kernelDensityEstimator(samples: number[], bandwidth: number) {
  return (x: number) =>
    samples.reduce(
      (sum, v) =>
        sum +
        Math.exp(-0.5 * ((x - v) / bandwidth) ** 2) /
          (Math.sqrt(2 * Math.PI) * bandwidth),
      0
    ) / samples.length;
}

function GenericDistributionPlot({
  values,
  color,
  yAxisAtZero = false,
  onLoad = () => {},
  Plotly,
}: DistributionPlotPropsWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  const plotData = useMemo(() => {
    if (!values || values.length < 2 || values.every((v) => v === values[0])) {
      return null;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const stdDev = Math.sqrt(
      values.reduce((s, v) => s + v * v, 0) / values.length -
        (values.reduce((a, b) => a + b) / values.length) ** 2
    );
    const bandwidth = 1.06 * stdDev * values.length ** -0.2 || 0.5;

    const kde = kernelDensityEstimator(values, bandwidth);
    const xPoints = Array.from(
      { length: 120 },
      (_, i) => min - range * 0.1 + (i * range * 1.2) / 120
    );
    const yPoints = xPoints.map(kde);

    return { xPoints, yPoints };
  }, [values]);

  useEffect(() => {
    if (!plotData || !ref.current) return;

    const plot = ref.current;
    const SEPARATOR_Y = 0.3;

    // 1. Calculate a shared range so y-axes (and the 0 line) align perfectly
    const xMin = Math.min(...plotData.xPoints, ...values);
    const xMax = Math.max(...plotData.xPoints, ...values);
    const sharedRange = [xMin, xMax];

    const traces: any[] = [
      {
        x: plotData.xPoints,
        y: plotData.yPoints,
        type: "scatter",
        mode: "lines",
        fill: "tozeroy",
        fillcolor: color,
        line: { color: "transparent" },
        yaxis: "y2",
        xaxis: "x2",
        name: "",
      },
      {
        x: values,
        y: values.map(() => 0),
        type: "scatter",
        mode: "markers",
        marker: {
          symbol: "line-ns-open",
          size: 20,
          color,
        },
        yaxis: "y1",
        xaxis: "x1",
        name: "",
        hoverinfo: "x",
      },
    ];

    const layout: Partial<Layout> = {
      width: 310,
      height: 250,
      margin: { l: 30, r: 30, t: 10, b: 20 },
      showlegend: false,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",

      xaxis: {
        range: sharedRange, // 2. Force identical range
        showgrid: false,
        showline: false,
        ticks: "",
        tickfont: { size: 14, color: "#333" },
        fixedrange: true,
        // Set to true and uncomment out the below to debug 0 line alignments
        zeroline: false,
        // zerolinecolor: "#ccc",
        // zerolinewidth: 1,
      },

      xaxis2: {
        range: sharedRange, // 3. Force identical range here too
        overlaying: "x",
        showgrid: false,
        showline: true,
        linecolor: "black",
        linewidth: 1.5,
        ticks: "outside",
        ticklen: 6,
        tickcolor: "black",
        showticklabels: false,
        position: SEPARATOR_Y,
        anchor: "free",
        fixedrange: true,
        // Match zeroline settings for perfect vertical alignment - if misalignment is suspected, switch this to true to debug
        zeroline: false,
        // zerolinecolor: "black",
        // zerolinewidth: 1,
      },

      yaxis: {
        domain: [0.05, SEPARATOR_Y],
        showgrid: false,
        showticklabels: false,
        zeroline: false,
        range: [-0.9, 0.1],
        fixedrange: true,
      },
      yaxis2: {
        domain: [SEPARATOR_Y, 1],
        showgrid: false,
        showticklabels: false,
        zeroline: false,
        fixedrange: true,
      },
    };

    Plotly.react(plot, traces, layout, {
      staticPlot: true,
      displayModeBar: false,
    });
  }, [Plotly, color, plotData, values]);

  return (
    <div style={{ minHeight: "200px" }}>
      {!plotData ? (
        <p style={{ padding: "20px", fontSize: "12px", color: "#666" }}>
          Insufficient variance.
        </p>
      ) : (
        <div ref={ref} />
      )}
    </div>
  );
}

export default function LazyGenericDistributionPlot(
  props: DistributionPlotProps
) {
  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) => (
        <GenericDistributionPlot {...props} Plotly={Plotly} />
      )}
    </PlotlyLoader>
  );
}
