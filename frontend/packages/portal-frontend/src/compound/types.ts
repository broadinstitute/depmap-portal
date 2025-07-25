type PRCid = string;
type ModelID = string;
type CompoundName = string;
type Viability = number | null;
type CellLineName = string;
type DoseWithUnits = `${number} uM`;
type DoseWithoutUnits = number;

export type DrugDoseLabel = `${CompoundName} (${PRCid}) @${DoseWithUnits}`;

export type CompoundDoseViability = Record<
  DrugDoseLabel,
  Record<ModelID, Viability>
>;

export type TableRow = {
  modelId: string;
  cellLine: CellLineName;
  auc: number;
} & {
  [K in DoseWithUnits]: Viability;
};

export type TableFormattedData = TableRow[];

export type HeatmapFormattedData = {
  modelIds: ModelID[];
  x: CellLineName[];
  y: DoseWithoutUnits[];
  z: Viability[][];
};
