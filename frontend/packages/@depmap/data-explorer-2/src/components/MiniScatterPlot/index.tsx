/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import type { Config, Layout } from "plotly.js";
import { Spinner } from "@depmap/common-components";
import { toPortalLink } from "@depmap/globals";
import { breadboxAPI } from "@depmap/api";
import { DataExplorerPlotConfig } from "@depmap/types";
import { usePlotlyLoader } from "../../contexts/PlotlyLoaderContext";
import styles from "./MiniScatterPlot.scss";

export interface MiniScatterPlotAxis {
  datasetId: string;
  featureGivenId: string;
  featureLabel: string;
  axisLabel: string;
}

interface Props {
  dimType: string;
  xAxis: MiniScatterPlotAxis;
  yAxis: MiniScatterPlotAxis;
}

interface AxisData {
  x: number[];
  y: number[];
  labels: string[];
}

function buildPlotConfig(
  dimType: string,
  xAxis: MiniScatterPlotAxis,
  yAxis: MiniScatterPlotAxis
): DataExplorerPlotConfig {
  const buildDimension = (axis: MiniScatterPlotAxis) => ({
    axis_type: "raw_slice" as const,
    slice_type: dimType,
    dataset_id: axis.datasetId,
    aggregation: "first" as const,
    context: {
      name: axis.featureLabel,
      dimension_type: dimType,
      expr: { "==": [{ var: "given_id" }, axis.featureGivenId] },
      vars: {},
    },
  });

  return {
    plot_type: "scatter",
    // index_type is the dimension each *point* represents (models/cell
    // lines), not the pinned features' dimension type (dimType, e.g.
    // "gene") — that's `slice_type` on each axis dimension below.
    index_type: "depmap_model",
    dimensions: {
      x: buildDimension(xAxis),
      y: buildDimension(yAxis),
    },
  };
}

function useAxisData(axis: MiniScatterPlotAxis) {
  const [values, setValues] = useState<{
    ids: string[];
    labels: string[];
    values: unknown[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setValues(null);
    setError(null);

    breadboxAPI
      .getDimensionData({
        dataset_id: axis.datasetId,
        identifier: axis.featureGivenId,
        identifier_type: "feature_id",
      })
      .then((result) => {
        if (!cancelled) {
          setValues(result);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [axis.datasetId, axis.featureGivenId]);

  return { values, error };
}

function joinAxisData(
  xData: { ids: string[]; labels: string[]; values: unknown[] },
  yData: { ids: string[]; labels: string[]; values: unknown[] }
): AxisData {
  const yById = new Map<string, { value: unknown; label: string }>();
  yData.ids.forEach((id, i) => {
    yById.set(id, { value: yData.values[i], label: yData.labels[i] });
  });

  const x: number[] = [];
  const y: number[] = [];
  const labels: string[] = [];

  xData.ids.forEach((id, i) => {
    const yEntry = yById.get(id);
    const xValue = Number(xData.values[i]);
    const yValue = yEntry ? Number(yEntry.value) : NaN;

    if (yEntry && Number.isFinite(xValue) && Number.isFinite(yValue)) {
      x.push(xValue);
      y.push(yValue);
      labels.push(xData.labels[i]);
    }
  });

  return { x, y, labels };
}

function Chart({
  data,
  xAxisLabel,
  yAxisLabel,
  Plotly,
}: {
  data: AxisData;
  xAxisLabel: string;
  yAxisLabel: string;
  Plotly: any;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const traces: Record<string, any>[] = [
      {
        type: "scatter",
        mode: "markers",
        x: data.x,
        y: data.y,
        text: data.labels,
        hovertemplate: "%{text}<br>x: %{x}<br>y: %{y}<extra></extra>",
        marker: { color: "#386FB4", size: 6 },
        name: "",
        showlegend: false,
      },
    ];

    if (data.x.length > 0) {
      const allValues = [...data.x, ...data.y];
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);

      traces.push({
        type: "scatter",
        mode: "lines",
        x: [min, max],
        y: [min, max],
        line: { color: "#999999", dash: "dash", width: 1 },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    const layout: Partial<Layout> = {
      height: 320,
      margin: { l: 60, r: 20, t: 20, b: 50 },
      xaxis: { title: xAxisLabel },
      yaxis: { title: yAxisLabel },
    };

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
    };

    Plotly.react(ref.current, traces, layout, config);
  }, [data, xAxisLabel, yAxisLabel, Plotly]);

  return <div ref={ref} />;
}

export default function MiniScatterPlot({ dimType, xAxis, yAxis }: Props) {
  const PlotlyLoader = usePlotlyLoader();
  const xAxisData = useAxisData(xAxis);
  const yAxisData = useAxisData(yAxis);

  const viewInDataExplorerUrl = toPortalLink(
    `/data_explorer_2?plot=${btoa(
      JSON.stringify(buildPlotConfig(dimType, xAxis, yAxis))
    )}`
  );

  if (xAxisData.error || yAxisData.error) {
    return (
      <div className={styles.message}>
        Something went wrong loading this plot.
      </div>
    );
  }

  if (!xAxisData.values || !yAxisData.values) {
    return (
      <div className={styles.message}>
        <Spinner position="static" />
      </div>
    );
  }

  const data = joinAxisData(xAxisData.values, yAxisData.values);

  return (
    <div>
      <PlotlyLoader version="module">
        {(Plotly) => (
          <Chart
            data={data}
            xAxisLabel={xAxis.axisLabel}
            yAxisLabel={yAxis.axisLabel}
            Plotly={Plotly}
          />
        )}
      </PlotlyLoader>
      <a
        className={styles.viewInDataExplorerLink}
        href={viewInDataExplorerUrl}
        target="_blank"
        rel="noreferrer"
      >
        View in Data Explorer
      </a>
    </div>
  );
}
