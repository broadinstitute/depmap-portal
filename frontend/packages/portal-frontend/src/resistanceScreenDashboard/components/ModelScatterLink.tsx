import React from "react";
import { SliceQuery } from "@depmap/types";

export interface ModelScatterLinkProps {
  dataset_id: string;
  getValue: (sliceQuery: SliceQuery) => unknown;
}

function ModelScatterLink({ dataset_id, getValue }: ModelScatterLinkProps) {
  const testArm = getValue({
    dataset_id: "PairedResScreenTable",
    identifier_type: "column",
    identifier: "TestArmModelID",
  });

  const control = getValue({
    dataset_id: "PairedResScreenTable",
    identifier_type: "column",
    identifier: "CtrlArmModelID",
  });

  const testArmLabel = getValue({
    dataset_id: "PairedResScreenTable",
    identifier_type: "column",
    identifier: "TestArmStrippedCellLineName",
  });

  const controlLabel = getValue({
    dataset_id: "PairedResScreenTable",
    identifier_type: "column",
    identifier: "CtrlArmStrippedCellLineName",
  });

  const plot = {
    index_type: "gene",
    plot_type: "scatter",
    dimensions: {
      x: {
        dataset_id,
        axis_type: "raw_slice",
        slice_type: "depmap_model",
        aggregation: "first",
        context: {
          name: testArmLabel || testArm,
          dimension_type: "depmap_model",
          expr: { "==": [{ var: "given_id" }, testArm] },
          vars: {},
        },
      },
      y: {
        dataset_id,
        axis_type: "raw_slice",
        slice_type: "depmap_model",
        aggregation: "first",
        context: {
          name: controlLabel || control,
          dimension_type: "depmap_model",
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
}

export default ModelScatterLink;
