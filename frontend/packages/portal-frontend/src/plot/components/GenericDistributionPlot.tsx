import { Layout } from "plotly.js";
import React, { useMemo, useRef } from "react";
import { useEffect } from "react";
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

// (Replaces sns.kdeplot)
function kernelDensityEstimator(samples: number[], bandwidth: number) {
  return (x: number) =>
    samples.reduce(
      (sum, v) =>
        sum +
        Math.exp(-0.5 * Math.pow((x - v) / bandwidth, 2)) /
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
    useEffect(() => {
      if (onLoad && ref.current) {
        onLoad(ref.current);
      }
    }, [onLoad]);

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
            Math.pow(values.reduce((a, b) => a + b) / values.length, 2)
        ) *
        Math.pow(values.length, -0.2) || 0.5;

    const kde = kernelDensityEstimator(values, bandwidth);
    const xPoints = Array.from(
      { length: 120 },
      (_, i) => min - range * 0.1 + (i * range * 1.2) / 120
    );
    const yPoints = xPoints.map(kde);

    return { xPoints, yPoints };
  }, [values]);

  if (!plotData) {
    return <p>Cannot create density plot. Insufficient variance in data.</p>;
  }

  useEffect(() => {
    const plot = ref.current as ExtendedPlotType;

    // 3. Define Plotly Traces
    const traces: any[] = [
      {
        // Top: KDE Fill (sns.kdeplot + fill_between)
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
        // Bottom: Rug/Eventplot (ax2.eventplot)
        x: values,
        y: values.map(() => 0),
        type: "scatter",
        mode: "markers",
        marker: {
          symbol: "line-ns-open",
          size: 12,
          line: { width: 1.5, color: color },
        },
        yaxis: "y1",
        name: "Events",
        hoverinfo: "x",
      },
    ];

    const hasZeroCross = Math.min(...values) <= 0 && Math.max(...values) >= 0;

    const layout: Partial<Layout> = {
      width: 450,
      height: 180,
      margin: { l: 10, r: 10, t: 10, b: 30 },
      showlegend: false,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        showgrid: false,
        zeroline: yAxisAtZero && hasZeroCross,
        zerolinecolor: "#333",
        tickfont: { size: 10 },
      },
      yaxis: {
        domain: [0, 0.15], // Bottom 15% for rug plot
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
      yaxis2: {
        domain: [0.2, 1], // Top 80% for density
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: false,
    };

    Plotly.react(plot, traces, layout, config);
  }, [Plotly]);

  return <div ref={ref} />;
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
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...otherProps}
          />
        ) : null
      }
    </PlotlyLoader>
  );
}
