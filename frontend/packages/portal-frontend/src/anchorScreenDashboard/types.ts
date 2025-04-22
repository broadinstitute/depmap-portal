type ExperimentID = string;

export interface AnchorScreenMetadata {
  ControlArmScreenID: Record<ExperimentID, string>;
  Drug: Record<ExperimentID, string>;
  DrugArmScreenID: Record<ExperimentID, string>;
  ExperimentID: Record<ExperimentID, string>;
  ModelID: Record<ExperimentID, string>;
  OncotreeLineage: Record<ExperimentID, string>;
  OncotreePrimaryDisease: Record<ExperimentID, string>;
  OncotreeSubtype: Record<ExperimentID, string>;
  StrippedCellLineName: Record<ExperimentID, string>;
}

export type TableRow = Record<keyof AnchorScreenMetadata, string>;
export type TableFormattedData = TableRow[];
export type CellData = { row: { original: TableRow } };
