/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react";
import type { Config, Layout } from "plotly.js";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import { Spinner } from "@depmap/common-components";
import { useCorrelationsWithActual } from "../../hooks/useCorrelationsWithActual";
import styles from "./FeatureRankPlot.scss";

interface Props {
  featureDatasetId: string;
  featureGivenId: string;
  featureLabel: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
}

interface RankedFeature {
  rank: number;
  label: string;
  given_id: string;
  cor: number;
}

function useRankedFeatures({
  featureDatasetId,
  featureGivenId,
  actualsDatasetId,
  actualsFeatureGivenId,
}: Props) {
  const { data, error } = useCorrelationsWithActual(
    featureDatasetId,
    actualsDatasetId,
    actualsFeatureGivenId
  );

  if (error || !data) {
    return { ranked: null, featureIndex: -1, error };
  }

  const ranked: RankedFeature[] = data.given_id
    .map((given_id, i) => ({
      given_id,
      label: data.label[i],
      cor: data.cor[i],
      rank: 0,
    }))
    .sort((a, b) => b.cor - a.cor)
    .map((f, i) => ({ ...f, rank: i + 1 }));

  const featureIndex = ranked.findIndex((f) => f.given_id === featureGivenId);

  return { ranked, featureIndex, error: null };
}

function Chart({
  ranked,
  featureIndex,
  featureLabel,
  Plotly,
}: {
  ranked: RankedFeature[];
  featureIndex: number;
  featureLabel: string;
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
        mode: "lines",
        x: ranked.map((f) => f.rank),
        y: ranked.map((f) => f.cor),
        line: { color: "#c1c7d0", width: 2 },
        hoverinfo: "skip",
        showlegend: false,
      },
    ];

    if (featureIndex >= 0) {
      const feature = ranked[featureIndex];

      traces.push({
        type: "scatter",
        mode: "markers",
        x: [feature.rank],
        y: [feature.cor],
        text: [`${featureLabel} (rank ${feature.rank} of ${ranked.length})`],
        hovertemplate: "%{text}<br>Correlation: %{y:.3f}<extra></extra>",
        marker: { color: "#DE350B", size: 9 },
        showlegend: false,
      });
    }

    const layout: Partial<Layout> = {
      height: 320,
      margin: { l: 60, r: 20, t: 20, b: 50 },
      xaxis: { title: "Rank" },
      yaxis: { title: "Correlation with Gene Effect" },
    };

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
    };

    Plotly.react(ref.current, traces, layout, config);
  }, [ranked, featureIndex, featureLabel, Plotly]);

  return <div ref={ref} />;
}

export default function FeatureRankPlot({
  featureDatasetId,
  featureGivenId,
  featureLabel,
  actualsDatasetId,
  actualsFeatureGivenId,
}: Props) {
  const PlotlyLoader = usePlotlyLoader();
  const { ranked, featureIndex, error } = useRankedFeatures({
    featureDatasetId,
    featureGivenId,
    featureLabel,
    actualsDatasetId,
    actualsFeatureGivenId,
  });

  if (error) {
    return (
      <div className={styles.message}>
        Something went wrong loading this plot.
      </div>
    );
  }

  if (!ranked) {
    return (
      <div className={styles.message}>
        <Spinner position="static" />
      </div>
    );
  }

  return (
    <PlotlyLoader version="module">
      {(Plotly) => (
        <Chart
          ranked={ranked}
          featureIndex={featureIndex}
          featureLabel={featureLabel}
          Plotly={Plotly}
        />
      )}
    </PlotlyLoader>
  );
}
