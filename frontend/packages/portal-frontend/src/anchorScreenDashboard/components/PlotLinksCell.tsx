import React from "react";
import type { ScreenPairMetadata } from "./useMetadata";
import styles from "../styles/AnchorScreenDashboard.scss";

interface Props {
  pairId: string;
  metadata: ScreenPairMetadata | null;
}

const ScatterLink = ({
  pairId,
  metadata,
}: {
  pairId: string;
  metadata: ScreenPairMetadata | null;
}) => {
  if (!metadata) {
    return "...";
  }

  const { TestArmScreenID, CtrlArmScreenID } = metadata;
  const testArm = TestArmScreenID[pairId];
  const control = CtrlArmScreenID[pairId];

  const plot = {
    index_type: "gene",
    plot_type: "scatter",
    dimensions: {
      x: {
        dataset_id: "ScreenGeneEffect",
        axis_type: "raw_slice",
        slice_type: "screen",
        aggregation: "first",
        context: {
          name: `${testArm} (test arm)`,
          dimension_type: "screen",
          expr: { "==": [{ var: "given_id" }, testArm] },
          vars: {},
        },
      },
      y: {
        dataset_id: "ScreenGeneEffect",
        axis_type: "raw_slice",
        slice_type: "screen",
        aggregation: "first",
        context: {
          name: `${control} (control arm)`,
          dimension_type: "screen",
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

function PlotLinksCell({ pairId, metadata }: Props) {
  if (!metadata) {
    return "...";
  }

  const xDataset = "PairedAnchorGeneEffectDiff";
  const yDataset = "PairedAnchorGeneEffectFDR";
  const { label } = metadata;

  const href =
    "../data_explorer_2/" +
    `?xDataset=${xDataset}&xSample=${label[pairId]}` +
    `&yDataset=${yDataset}&ySample=${label[pairId]}`;

  return (
    <span>
      <a href={href} rel="noreferrer" target="_blank">
        Volcano
      </a>
      <span className={styles.cellDivider} />
      <ScatterLink pairId={pairId} metadata={metadata} />
    </span>
  );
}

export default PlotLinksCell;
