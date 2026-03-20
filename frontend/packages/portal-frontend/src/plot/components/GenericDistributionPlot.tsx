import { Layout } from "plotly.js";
import React, { useMemo, useRef, useEffect } from "react";
import PlotlyLoader, { PlotlyType } from "src/plot/components/PlotlyLoader";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

interface DistributionPlotProps {
  values: number[];
  color: string;
  xaxisLabel: string;
  highlightLineLabel?: string;
  fillOpacity?: number; // (0 to 1)
  includeRugPlot?: boolean;
  highlightValue?: number;
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
  fillOpacity = 1, // Default to 1 (fully opaque)
  includeRugPlot = true,
  highlightValue = undefined,
  highlightLineLabel = undefined,
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
    const scottsFactor = n ** (-1 / (1 + 4));

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
    const maxY = Math.max(...plotData.yPoints);

    // Define which axes we are using based on includeRugPlot
    const mainX = includeRugPlot ? "x2" : "x";
    const mainY = includeRugPlot ? "y2" : "y";
    const SEPARATOR_Y = 0.15;

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
        fillcolor: hexToRgba(color, fillOpacity),
        line: { color: "transparent" },
        yaxis: mainY,
        xaxis: mainX,
        name: "",
      },
    ];

    if (includeRugPlot) {
      traces.push({
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
      });
    }

    if (highlightValue !== undefined) {
      traces.push({
        x: [highlightValue, highlightValue],
        // If no rug plot, start at 0, otherwise start slightly below 0 to cross the rug
        y: [includeRugPlot ? -0.5 : 0, maxY * 1.1],
        type: "scatter",
        mode: "lines",
        line: {
          color,
          width: 3,
          dash: "solid",
        },
        yaxis: mainY,
        xaxis: mainX,
        name: "",
        hoverinfo: "x",
      });
    }

    const annotations: any[] = [];
    if (highlightValue !== undefined && highlightLineLabel) {
      annotations.push({
        x: highlightValue,
        y: maxY * 1.1,
        xref: mainX,
        yref: mainY,
        text: `<b>${highlightLineLabel}</b>`,
        showarrow: false,
        font: {
          family: "Lato, sans-serif",
          size: 12,
          color,
        },
        align: "right",
        xanchor: "center",
        yanchor: "bottom",
        xshift: -6,
      });
    }

    const layout: Partial<Layout> = {
      autosize: true,
      height: 250,
      margin: { l: 20, r: 20, t: 10, b: 50 },
      showlegend: false,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",

      // The base xaxis - shows labels/numbers
      xaxis: {
        title: xaxisLabel,
        range: sharedRange,
        showgrid: false,
        showline: !includeRugPlot, // Only show a line here if it's the only axis
        linecolor: "black",
        linewidth: 1,
        ticks: "outside",
        showticklabels: !includeRugPlot,
        tickfont: { size: 12, color: "#333" },
        fixedrange: true,
        zeroline: false,
      },

      // The base yaxis - domain changes based on rug plot presence
      yaxis: {
        domain: includeRugPlot ? [0.05, SEPARATOR_Y] : [0, 1],
        showgrid: false,
        showticklabels: false,
        zeroline: false,
        range: includeRugPlot ? [-0.9, 0.1] : [0, maxY * 1.2],
        fixedrange: true,
      },

      // Only add secondary axes if we have a rug plot
      ...(includeRugPlot && {
        xaxis2: {
          range: sharedRange,
          overlaying: "x",
          showgrid: false,
          showline: true,
          linecolor: "black",
          linewidth: 1,
          ticks: "outside",
          ticklen: 20,
          tickcolor: "black",
          showticklabels: true,
          position: SEPARATOR_Y,
          anchor: "free",
          fixedrange: true,
          zeroline: false,
        },
        yaxis2: {
          domain: [SEPARATOR_Y, 1],
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          range: [0, maxY * 1.1],
          fixedrange: true,
        },
      }),
      annotations,
    };

    Plotly.react(plot, traces, layout, {
      staticPlot: true,
      displayModeBar: false,
      responsive: true,
    });
  }, [
    Plotly,
    color,
    plotData,
    values,
    xaxisLabel,
    highlightValue,
    highlightLineLabel,
    includeRugPlot,
    fillOpacity,
  ]);

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

export default function LazyGenericDistributionPlot({
  ...props
}: DistributionPlotProps) {
  return (
    <PlotlyLoader version="module">
      {(Plotly: PlotlyType) => (
        <GenericDistributionPlot {...props} Plotly={Plotly} />
      )}
    </PlotlyLoader>
  );
}
