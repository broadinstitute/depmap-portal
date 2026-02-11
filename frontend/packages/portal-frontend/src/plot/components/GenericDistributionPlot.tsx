import { Layout } from "plotly.js";
import React, { useMemo, useRef, useEffect } from "react";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface DistributionPlotProps {
  values: number[];
  color: string;
  xaxisLabel: string;
  onLoad?: (plot: ExtendedPlotType) => void;
}

type DistributionPlotPropsWithPlotly = DistributionPlotProps & {
  Plotly: PlotlyType;
};

function kernelDensityEstimator(samples: number[], bandwidth: number) {
  const constant = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
  return (x: number) =>
    samples.reduce(
      (sum, v) => sum + Math.exp(-0.5 * ((x - v) / bandwidth) ** 2),
      0
    ) *
    (constant / samples.length);
}

function GenericDistributionPlot({
  values,
  color,
  xaxisLabel,
  onLoad = () => {},
  Plotly,
}: DistributionPlotPropsWithPlotly) {
  const ref = useRef<ExtendedPlotType>(null);

  useEffect(() => {
    if (onLoad && ref.current) {
      onLoad(ref.current);
    }
  }, [onLoad]);

  // Calculation of plot data adapted/translated from the legacy python/seaborn version of this plot
  const plotData = useMemo(() => {
    if (!values || values.length < 2 || values.every((v) => v === values[0])) {
      return null;
    }

    const n = values.length;

    // 1. Calculate Mean
    const mean = values.reduce((a, b) => a + b, 0) / n;

    // 2. Calculate Variance (Unbiased - ddof=1 to match Scipy/Pandas default)
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    // 3. Scipy's Scott's Factor logic
    // scipy.stats.gaussian_kde.scotts_factor() = n**(-1./(d+4))
    const scottsFactor = Math.pow(n, -1 / (1 + 4));

    // 4. Bandwidth is factor * stdDev
    const bandwidth = scottsFactor * stdDev;

    const kde = kernelDensityEstimator(values, bandwidth);

    // 5. Seaborn Grid Logic
    // Seaborn extends the range by a fixed fraction of the data range
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Seaborn uses a "cut" parameter (default 3) which extends the grid
    // by cut * bandwidth beyond the min/max
    const cut = 3;
    const plotMin = min - cut * bandwidth;
    const plotMax = max + cut * bandwidth;
    const plotRange = plotMax - plotMin;

    // Python Seaborn uses 100 points by default for the KDE line
    const xPoints = Array.from(
      { length: 100 },
      (_, i) => plotMin + (i * plotRange) / 99
    );
    const yPoints = xPoints.map(kde);

    return { xPoints, yPoints };
  }, [values]);

  useEffect(() => {
    if (!plotData || !ref.current) return;

    const plot = ref.current;
    const SEPARATOR_Y = 0.15; // The rug plot takes up 15% of the total height.

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
      autosize: true,
      height: 250,
      margin: { l: 20, r: 20, t: 10, b: 30 },
      showlegend: false,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",

      xaxis: {
        title: xaxisLabel,
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
      responsive: true,
    });

    // Use ResizeObserver for the column shifts
    const observer = new ResizeObserver(() => {
      // Plotly.Plots.resize is asynchronous by default.
      // Calling it inside an observer during a flex-basis change
      // can cause a 1-frame "pop".
      // We call it directly here.
      if (ref.current) {
        Plotly.Plots.resize(plot);
      }
    });

    observer.observe(plot);

    return () => observer.disconnect();
  }, [Plotly, color, plotData, values, xaxisLabel]);

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
