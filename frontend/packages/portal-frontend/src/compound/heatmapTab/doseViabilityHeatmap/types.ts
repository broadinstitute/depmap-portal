type PRCid = string;
type ModelID = string;
type CompoundName = string;
export type Viability = number | null;
type CellLineName = string;
type DoseWithUnits = `${number} uM`;
type DoseWithoutUnits = number;

export type DrugDoseLabel = `${CompoundName} (${PRCid}) @${DoseWithUnits}`;

export type CompoundDoseViability = Record<
  DrugDoseLabel,
  Record<ModelID, Viability>
>;

type TableRow = {
  depmapId: string;
  "Cell Line": CellLineName;
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
