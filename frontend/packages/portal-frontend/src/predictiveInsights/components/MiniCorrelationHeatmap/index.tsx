/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import type { Config, Layout } from "plotly.js";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import { Spinner } from "@depmap/common-components";
import { breadboxAPI } from "@depmap/api";
import { correlationMatrix } from "@depmap/statistics";
import { getCorrelationColor } from "@depmap/utils";
import styles from "./MiniCorrelationHeatmap.scss";

// Same diverging red/blue correlation color convention used by the Top
// Co-dependencies tile (CorrelationMeter/CorrelationBar), sampled into a
// Plotly colorscale (stop positions normalized from [-1, 1] to [0, 1] to
// match this trace's zmin/zmax).
const CORRELATION_COLORSCALE: [number, string][] = Array.from(
  { length: 11 },
  (_, i) => [i / 10, getCorrelationColor(-1 + i * 0.2)]
);

export interface MiniCorrelationHeatmapFeature {
  datasetId: string;
  featureGivenId: string;
  featureLabel: string;
}

interface Props {
  // Not used to fetch/compute the heatmap itself (plain feature-to-feature
  // correlation doesn't need it) — kept on the public API to mirror
  // MiniScatterPlot and for a future "View in Data Explorer" link.
  // eslint-disable-next-line react/no-unused-prop-types
  dimType: string;
  features: MiniCorrelationHeatmapFeature[];
}

interface FeatureVector {
  ids: string[];
  values: number[];
}

function useFeatureVectors(features: MiniCorrelationHeatmapFeature[]) {
  const [vectors, setVectors] = useState<FeatureVector[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const key = features
    .map((f) => `${f.datasetId}:${f.featureGivenId}`)
    .join(",");

  useEffect(() => {
    let cancelled = false;
    setVectors(null);
    setError(null);

    Promise.all(
      features.map((feature) =>
        breadboxAPI.getDimensionData({
          dataset_id: feature.datasetId,
          identifier: feature.featureGivenId,
          identifier_type: "feature_id",
        })
      )
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        setVectors(
          results.map((result) => ({
            ids: result.ids,
            values: result.values.map(Number),
          }))
        );
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
  }, [key]);

  return { vectors, error };
}

// Aligns every feature's values onto the set of ids common to all of them,
// so the correlation matrix is computed over a consistent set of models.
// Keyed by each feature's index (as a string) rather than its label, since
// labels aren't guaranteed unique.
function alignOnCommonIds(vectors: FeatureVector[]): Record<string, number[]> {
  const commonIds = vectors
    .map((v) => new Set(v.ids))
    .reduce((a, b) => new Set([...a].filter((id) => b.has(id))));

  const data: Record<string, number[]> = {};

  vectors.forEach((vector, index) => {
    const byId = new Map(vector.ids.map((id, i) => [id, vector.values[i]]));
    data[String(index)] = [...commonIds]
      .map((id) => byId.get(id) as number)
      .filter((value) => Number.isFinite(value));
  });

  return data;
}

// Module-level so the cache survives across heatmap instances, not just one
// component mount.
const datasetNameCache = new Map<string, Promise<string>>();

function fetchDatasetName(datasetId: string): Promise<string> {
  if (!datasetNameCache.has(datasetId)) {
    datasetNameCache.set(
      datasetId,
      breadboxAPI
        .getDataset(datasetId)
        .then((dataset) => dataset.name)
        .catch(() => datasetId)
    );
  }

  return datasetNameCache.get(datasetId) as Promise<string>;
}

function useDatasetNames(datasetIds: string[]) {
  const key = datasetIds.join(",");
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      datasetIds.map((id) =>
        fetchDatasetName(id).then((name) => [id, name] as const)
      )
    ).then((pairs) => {
      if (!cancelled) {
        setNames(Object.fromEntries(pairs));
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}

function Chart({
  labels,
  datasetNames,
  matrix,
  Plotly,
}: {
  labels: string[];
  datasetNames: string[];
  matrix: number[][];
  Plotly: any;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    // customdata[i][j] pairs the x-axis feature's dataset name (index j)
    // with the y-axis feature's dataset name (index i), matching how
    // Plotly indexes a heatmap's z values: z[i][j] -> (y=labels[i], x=labels[j]).
    const customdata = matrix.map((row, i) =>
      row.map((_, j) => [datasetNames[j], datasetNames[i]])
    );

    const trace = {
      type: "heatmap",
      x: labels,
      y: labels,
      z: matrix,
      zmin: -1,
      zmax: 1,
      colorscale: CORRELATION_COLORSCALE,
      customdata,
      hovertemplate:
        "%{y} (%{customdata[1]}) vs. %{x} (%{customdata[0]})<br>Correlation: %{z:.3f}<extra></extra>",
    };

    const layout: Partial<Layout> = {
      height: Math.max(320, labels.length * 24 + 120),
      margin: { l: 120, r: 20, t: 20, b: 120 },
      xaxis: { tickangle: -45, automargin: true },
      yaxis: { automargin: true },
    };

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
    };

    Plotly.react(ref.current, [trace], layout, config);
  }, [labels, datasetNames, matrix, Plotly]);

  return <div ref={ref} />;
}

export default function MiniCorrelationHeatmap({ features }: Props) {
  const PlotlyLoader = usePlotlyLoader();
  const { vectors, error } = useFeatureVectors(features);

  const datasetIds = [...new Set(features.map((f) => f.datasetId))];
  const datasetNamesById = useDatasetNames(datasetIds);

  if (error) {
    return (
      <div className={styles.message}>
        Something went wrong loading this heatmap.
      </div>
    );
  }

  if (!vectors) {
    return (
      <div className={styles.message}>
        <Spinner position="static" />
      </div>
    );
  }

  // Hierarchical clustering (average-linkage on 1 - abs(correlation)) groups
  // similar features together instead of leaving them in importance-rank
  // order — same reordering approach used by Data Explorer's own
  // correlation heatmap. Needs at least 3 features to be meaningful/stable.
  const { columns, matrix } = correlationMatrix(
    alignOnCommonIds(vectors),
    features.length > 2
  );
  const order = columns.map(Number);
  const labels = order.map((i) => features[i].featureLabel);
  const datasetNames = order.map(
    (i) => datasetNamesById[features[i].datasetId] || features[i].datasetId
  );

  return (
    <PlotlyLoader version="module">
      {(Plotly) => (
        <Chart
          labels={labels}
          datasetNames={datasetNames}
          matrix={matrix}
          Plotly={Plotly}
        />
      )}
    </PlotlyLoader>
  );
}
