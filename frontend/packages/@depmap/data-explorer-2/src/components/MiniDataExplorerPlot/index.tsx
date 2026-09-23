/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import type { Config, Layout } from "plotly.js";
import { Spinner } from "@depmap/common-components";
import { toPortalLink } from "@depmap/globals";
import { breadboxAPI } from "@depmap/api";
import { DataExplorerPlotConfig } from "@depmap/types";
import { usePlotlyLoader } from "../../contexts/PlotlyLoaderContext";
import styles from "./MiniDataExplorerPlot.scss";

interface Props {
  plotConfig: DataExplorerPlotConfig;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

interface AxisData {
  x: number[];
  y: number[];
  labels: string[];
}

// The only expression shape this component knows how to read: a single
// feature pinned via `{"==": [{"var": "given_id"}, id]}` (see
// DataExplorerPlotConfigDimension.context.expr). Anything else means the
// config isn't the single-feature "raw_slice" shape this v1 supports.
function getPinnedGivenId(
  dimension: DataExplorerPlotConfig["dimensions"]["x"]
): string | null {
  const expr = dimension?.context?.expr;

  if (
    expr &&
    typeof expr === "object" &&
    "==" in expr &&
    Array.isArray((expr as any)["=="])
  ) {
    return String((expr as any)["=="][1]);
  }

  return null;
}

function useAxisData(dimension: DataExplorerPlotConfig["dimensions"]["x"]) {
  const [values, setValues] = useState<{
    ids: string[];
    labels: string[];
    values: unknown[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const datasetId = dimension?.dataset_id;
  const givenId = dimension ? getPinnedGivenId(dimension) : null;

  useEffect(() => {
    let cancelled = false;
    setValues(null);
    setError(null);

    if (!datasetId || !givenId) {
      setError(new Error("Unsupported plot config dimension"));
      return undefined;
    }

    breadboxAPI
      .getDimensionData({
        dataset_id: datasetId,
        identifier: givenId,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, givenId]);

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
  hideIdentityLine,
  xAxisLabel = undefined,
  yAxisLabel = undefined,
  Plotly,
}: {
  data: AxisData;
  hideIdentityLine: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
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

    if (!hideIdentityLine && data.x.length > 0) {
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
  }, [data, hideIdentityLine, xAxisLabel, yAxisLabel, Plotly]);

  return <div ref={ref} />;
}

export default function MiniDataExplorerPlot({
  plotConfig,
  xAxisLabel = undefined,
  yAxisLabel = undefined,
}: Props) {
  const PlotlyLoader = usePlotlyLoader();

  if (plotConfig.plot_type !== "scatter") {
    return (
      <div className={styles.message}>
        Unsupported plot type &quot;{plotConfig.plot_type}&quot;.
      </div>
    );
  }

  return (
    <MiniScatterPlot
      plotConfig={plotConfig}
      xAxisLabel={xAxisLabel}
      yAxisLabel={yAxisLabel}
      PlotlyLoader={PlotlyLoader}
    />
  );
}

function MiniScatterPlot({
  plotConfig,
  xAxisLabel = undefined,
  yAxisLabel = undefined,
  PlotlyLoader,
}: {
  plotConfig: DataExplorerPlotConfig;
  xAxisLabel?: string;
  yAxisLabel?: string;
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>;
}) {
  const xAxis = useAxisData(plotConfig.dimensions.x);
  const yAxis = useAxisData(plotConfig.dimensions.y);

  const viewInDataExplorerUrl = toPortalLink(
    `/data_explorer_2?plot=${btoa(JSON.stringify(plotConfig))}`
  );

  if (xAxis.error || yAxis.error) {
    return (
      <div className={styles.message}>
        Something went wrong loading this plot.
      </div>
    );
  }

  if (!xAxis.values || !yAxis.values) {
    return (
      <div className={styles.message}>
        <Spinner position="static" />
      </div>
    );
  }

  const data = joinAxisData(xAxis.values, yAxis.values);

  return (
    <div>
      <PlotlyLoader version="module">
        {(Plotly) => (
          <Chart
            data={data}
            hideIdentityLine={Boolean(plotConfig.hide_identity_line)}
            xAxisLabel={xAxisLabel}
            yAxisLabel={yAxisLabel}
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
