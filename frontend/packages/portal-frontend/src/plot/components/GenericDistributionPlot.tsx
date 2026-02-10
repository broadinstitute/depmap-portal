import { Layout } from "plotly.js";
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
    // 1. Validation: Handle zero variance/empty
    if (values.length < 2 || values.every((v) => v === values[0])) {
      return null;
    }

    // 2. Generate KDE Curve points
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const bandwidth =
      1.06 *
        Math.sqrt(
          values.reduce((s, v) => s + v * v, 0) / values.length -
            (values.reduce((a, b) => a + b) / values.length) ** 2
        ) *
        values.length ** -0.2 || 0.5;

    const kde = kernelDensityEstimator(values, bandwidth);
    const xPoints = Array.from(
      { length: 120 },
      (_, i) => min - range * 0.1 + (i * range * 1.2) / 120
    );
    const yPoints = xPoints.map(kde);

    return { xPoints, yPoints };
  }, [values]);

  useEffect(() => {
    if (!plotData || !ref.current) {
      return;
    }

    const plot = ref.current;

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
        name: "Density",
      },
      {
        x: values,
        y: values.map(() => 0),
        type: "scatter",
        mode: "markers",
        marker: {
          symbol: "line-ns-open",
          size: 12,
          color,
          line: { width: 1.5, color },
        },
        yaxis: "y1",
        name: "",
        hoverinfo: "x",
      },
    ];

    const hasZeroCross = Math.min(...values) <= 0 && Math.max(...values) >= 0;

    const layout: Partial<Layout> = {
      width: 310,
      height: 180,
      margin: { l: 10, r: 10, t: 10, b: 0 },
      showlegend: false,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        showgrid: false,
        zeroline: yAxisAtZero && hasZeroCross,
        zerolinecolor: "#333",
        tickfont: { size: 12 },
      },
      yaxis: {
        domain: [0, 0.2],
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
      yaxis2: {
        domain: [0.2, 1],
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
    };

    Plotly.react(plot, traces, layout, {
      staticPlot: true,
      displayModeBar: false,
    });
  }, [Plotly, color, plotData, values, yAxisAtZero]);

  // Use a conditional inside the return so hooks are always called in the same order
  return (
    <>
      {!plotData ? (
        <p>Cannot create density plot. Insufficient variance in data.</p>
      ) : (
        <div ref={ref} />
      )}
    </>
  );
}

export default function LazyGenericDistributionPlot({
  values,
  ...otherProps
}: DistributionPlotProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) =>
        values ? (
          <GenericDistributionPlot
            values={values}
            Plotly={Plotly}
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
