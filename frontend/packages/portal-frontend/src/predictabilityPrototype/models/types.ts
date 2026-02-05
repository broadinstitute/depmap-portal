export enum ModelName {
  CellContext = "CellContext",
  Confounders = "Confounders",
  DriverEvents = "DriverEvents",
  GeneticDerangement = "GeneticDerangement",
  DNA = "DNA",
  RNASeq = "RNASeq",
}

export enum ScreenType {
  CRISPR = "crispr",
  RNAI = "rnai",
}

export const DENSITY_COLOR_SCALE = [
  ["0.0", "#0B1D4B"],
  ["0.111111", "#192E75"],
  ["0.222222", "#2968A4"],
  ["0.333333", "#388BB3"],
  ["0.444444", "#50A8B8"],
  ["0.555555", "#76BFB5"],
  ["0.666666", "#A7D5B1"],
  ["0.777777", "#D4E9B0"],
  ["0.888888", "#EFF6BB"],
  ["1.0", "#FFFED8"],
];

export const SCREEN_TYPE_COLORS = new Map<string, string>([
  [ScreenType.CRISPR, "#2FA9D0"],
  [ScreenType.RNAI, "#5236A1"],
]);

export const FEATURE_SET_COLORS = new Map<string, string>([
  [ModelName.CellContext, "#244A95"],
  [ModelName.Confounders, "#06402b"],
  [ModelName.DriverEvents, "#56B7A9"],
  [ModelName.GeneticDerangement, "#E1790E"],
  [ModelName.DNA, "#C55252"],
  [ModelName.RNASeq, "#863D8D"],
]);
