/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import type { Config, Layout } from "plotly.js";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import { Spinner } from "@depmap/common-components";
import { breadboxAPI } from "@depmap/api";
import { useCorrelationsWithActual } from "../../hooks/useCorrelationsWithActual";
import styles from "./DatasetCorrelationScatterPlot.scss";

interface Props {
  featureDatasetId: string;
  featureGivenId: string;
  featureLabel: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
}

interface Point {
  label: string;
  corrWithFeature: number;
  corrWithActual: number;
}

function useCorrelationsWithFeature(
  featureDatasetId: string,
  featureGivenId: string
) {
  const [data, setData] = useState<{
    given_id: string[];
    cor: number[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    breadboxAPI
      .computeAssociations(featureDatasetId, {
        dataset_id: featureDatasetId,
        identifier: featureGivenId,
        identifier_type: "feature_id",
      })
      .then((result) => {
        if (!cancelled) {
          setData(result);
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
  }, [featureDatasetId, featureGivenId]);

  return { data, error };
}

function usePoints({
  featureDatasetId,
  featureGivenId,
  actualsDatasetId,
  actualsFeatureGivenId,
}: Props) {
  const corrWithFeature = useCorrelationsWithFeature(
    featureDatasetId,
    featureGivenId
  );
  const corrWithActual = useCorrelationsWithActual(
    featureDatasetId,
    actualsDatasetId,
    actualsFeatureGivenId
  );

  const error = corrWithFeature.error || corrWithActual.error;

  if (error || !corrWithFeature.data || !corrWithActual.data) {
    return { points: null, error };
  }

  const corrWithFeatureById = new Map<string, number>();
  corrWithFeature.data.given_id.forEach((id, i) => {
    corrWithFeatureById.set(id, corrWithFeature.data!.cor[i]);
  });

  const points: Point[] = [];
  corrWithActual.data.given_id.forEach((id, i) => {
    // Exclude the feature's correlation with itself — always 1 and
    // uninformative.
    if (id === featureGivenId) {
      return;
    }

    const corrWithFeatureValue = corrWithFeatureById.get(id);
    if (corrWithFeatureValue !== undefined) {
      points.push({
        label: corrWithActual.data!.label[i],
        corrWithFeature: corrWithFeatureValue,
        corrWithActual: corrWithActual.data!.cor[i],
      });
    }
  });

  return { points, error: null };
}

function Chart({
  points,
  featureLabel,
  Plotly,
}: {
  points: Point[];
  featureLabel: string;
  Plotly: any;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const trace = {
      type: "scatter",
      mode: "markers",
      x: points.map((p) => p.corrWithFeature),
      y: points.map((p) => p.corrWithActual),
      text: points.map((p) => p.label),
      hovertemplate:
        "%{text}<br>Corr. with feature: %{x:.3f}<br>Corr. with actual: %{y:.3f}<extra></extra>",
      marker: { color: "#386FB4", size: 6 },
      name: "",
      showlegend: false,
    };

    const layout: Partial<Layout> = {
      height: 320,
      margin: { l: 60, r: 20, t: 20, b: 50 },
      xaxis: { title: `Correlation with ${featureLabel}` },
      yaxis: { title: "Correlation with Gene Effect" },
    };

    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
    };

    Plotly.react(ref.current, [trace], layout, config);
  }, [points, featureLabel, Plotly]);

  return <div ref={ref} />;
}

export default function DatasetCorrelationScatterPlot({
  featureDatasetId,
  featureGivenId,
  featureLabel,
  actualsDatasetId,
  actualsFeatureGivenId,
}: Props) {
  const PlotlyLoader = usePlotlyLoader();
  const { points, error } = usePoints({
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

  if (!points) {
    return (
      <div className={styles.message}>
        <Spinner position="static" />
      </div>
    );
  }

  return (
    <PlotlyLoader version="module">
      {(Plotly) => (
        <Chart points={points} featureLabel={featureLabel} Plotly={Plotly} />
      )}
    </PlotlyLoader>
  );
}
