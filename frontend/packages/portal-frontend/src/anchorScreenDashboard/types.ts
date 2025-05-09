type ExperimentID = string;

export interface AnchorScreenMetadata {
  ControlArmAvgCPD: Record<ExperimentID, number>;
  ControlArmScreenID: Record<ExperimentID, string>;
  Drug: Record<ExperimentID, string>;
  DrugArmAvgCPD: Record<ExperimentID, number>;
  DrugArmScreenID: Record<ExperimentID, string>;
  DrugConcentration: Record<ExperimentID, string>;
  ExperimentID: Record<ExperimentID, string>;
  ModelID: Record<ExperimentID, string>;
  OncotreeLineage: Record<ExperimentID, string>;
  OncotreePrimaryDisease: Record<ExperimentID, string>;
  OncotreeSubtype: Record<ExperimentID, string>;
  PercentCPDChange: Record<ExperimentID, number>;
  StrippedCellLineName: Record<ExperimentID, string>;
}

export type TableRow = Record<keyof AnchorScreenMetadata, string>;
export type TableFormattedData = TableRow[];
export type CellData = { row: { original: TableRow } };
