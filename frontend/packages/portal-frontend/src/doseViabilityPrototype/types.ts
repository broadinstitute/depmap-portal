type DrugDoseLabel = `${string} (${string}) @${number} uM`;
type Viability = number;
export type CompoundDoseViability = Record<DrugDoseLabel, Viability>;

export type TableFormattedData = {
  dose: number;
  model: string;
  viability: number;
}[];

export type HeatmapFormattedData = {
  x: string[];
  y: string[];
  z: (number | null)[][];
};
