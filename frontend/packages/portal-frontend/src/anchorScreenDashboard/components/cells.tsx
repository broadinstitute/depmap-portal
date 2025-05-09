import React from "react";
import type { CellData } from "src/anchorScreenDashboard/types";

const encode = (s: string) => encodeURIComponent(s);

export function ModelIdCell(cellData: unknown) {
  const { ModelID } = (cellData as CellData).row.original;

  return (
    <a href={`../cell_line/${ModelID}`} rel="noreferrer" target="_blank">
      {ModelID}
    </a>
  );
}

export function VolcanoPlotCell(cellData: unknown) {
  const { ExperimentID } = (cellData as CellData).row.original;
  const xDataset = "anchor_diff_gene_effect";
  const yDataset = "anchor_diff_significance";

  const href =
    "../data_explorer_2/" +
    `?xDataset=${encode(xDataset)}&xSample=${encode(ExperimentID)}` +
    `&yDataset=${encode(yDataset)}&ySample=${encode(ExperimentID)}`;

  return (
    <a href={href} rel="noreferrer" target="_blank">
      Volcano
    </a>
  );
}

export function ScatterPlotCell(cellData: unknown) {
  const {
    DrugArmScreenID,
    ControlArmScreenID,
  } = (cellData as CellData).row.original;
  const datasetId = "ScreenGeneEffect";

  const href =
    "../data_explorer_2/" +
    `?xDataset=${encode(datasetId)}&xSample=${encode(DrugArmScreenID)}` +
    `&yDataset=${encode(datasetId)}&ySample=${encode(ControlArmScreenID)}`;

  return (
    <a href={href} rel="noreferrer" target="_blank">
      Scatter
    </a>
  );
}
