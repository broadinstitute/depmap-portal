import React from "react";
import type { AnchorPlotMetadata } from "./useMetadata";
import styles from "../styles/AnchorScreenDashboard.scss";

interface Props {
  experimentId: string;
  metadata: AnchorPlotMetadata | null;
}

const ScatterLink = ({
  experimentId,
  metadata,
}: {
  experimentId: string;
  metadata: AnchorPlotMetadata | null;
}) => {
  if (!metadata) {
    return "...";
  }

  const { DrugArmScreenID, ControlArmScreenID } = metadata;
  const drug = DrugArmScreenID[experimentId];
  const control = ControlArmScreenID[experimentId];

  const plot = {
    index_type: "gene",
    plot_type: "scatter",
    dimensions: {
      x: {
        dataset_id: "ScreenGeneEffect",
        axis_type: "raw_slice",
        slice_type: "Screen metadata",
        aggregation: "first",
        context: {
          name: `${drug} (drug arm)`,
          dimension_type: "Screen metadata",
          expr: { "==": [{ var: "given_id" }, drug] },
          vars: {},
        },
      },
      y: {
        dataset_id: "ScreenGeneEffect",
        axis_type: "raw_slice",
        slice_type: "Screen metadata",
        aggregation: "first",
        context: {
          name: `${control} (control arm)`,
          dimension_type: "Screen metadata",
          expr: { "==": [{ var: "given_id" }, control] },
          vars: {},
        },
      },
    },
  };

  const href = `../data_explorer_2?plot=${btoa(JSON.stringify(plot))}`;

  return (
    <a href={href} rel="noreferrer" target="_blank">
      Scatter
    </a>
  );
};

function PlotLinksCell({ experimentId, metadata }: Props) {
  const xDataset = "anchor_diff_gene_effect";
  const yDataset = "anchor_diff_significance";

  const href =
    "../data_explorer_2/" +
    `?xDataset=${xDataset}&xSample=${experimentId}` +
    `&yDataset=${yDataset}&ySample=${experimentId}`;

  return (
    <span>
      <a href={href} rel="noreferrer" target="_blank">
        Volcano
      </a>
      <span className={styles.cellDivider} />
      <ScatterLink experimentId={experimentId} metadata={metadata} />
    </span>
  );
}

export default PlotLinksCell;
