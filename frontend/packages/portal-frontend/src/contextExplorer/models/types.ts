export interface Summary {
  all_depmap_ids: [number, string][];
  data_types: string[];
  values: boolean[][];
}

export interface AvailabilitySummary {
  summary: Summary;
  table: { [key: string]: string | boolean }[];
}

export interface ContextSummary {
  all_depmap_ids: [number, string][];
  data_types: string[];
  values: number[][];
}

export interface DataAvailabilitySummary {
  summary: ContextSummary;
  table: { [key: string]: string | boolean }[];
}

export interface ContextSelectionInfo {
  sortedSelectedValues: number[][];
  overlapDepmapIds: string[];
}

export interface CellLineOverview {
  depmapId: string;
  cellLineDisplayName: string;
  lineage: string;
  primaryDisease: string;
  level0: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
  crispr: string;
  rnai: string;
  wgs: string;
  wes: string;
  prismOncRef: string;
  prismRepurposing: string;
}

export enum DataType {
  PRISMRepurposing,
  PRISMOncRef,
  RNASeq,
  WGS,
  WES,
  RNAi,
  CRISPR,
  default,
}

export enum DataTypeStrings {
  PRISMRepurposing = "PRISMRepurposing",
  PRISMOncRef = "PRISMOncRef",
  RNASeq = "RNASeq",
  WGS = "WGS",
  WES = "WES",
  RNAi = "RNAi",
  CRISPR = "CRISPR",
}

export enum DataTypeCategory {
  LossOfFunction = 1,
  OMICS = 2,
  CompoundViability = 3,
  Subtype = 4,
}

export function getDataTypeColorCategoryFromDataTypeValue(
  datatypeIndex: number,
  cellLineAvailable: boolean
) {
  if (!cellLineAvailable) {
    return 0;
  }

  switch (datatypeIndex) {
    case DataType.CRISPR:
    case DataType.RNAi:
      return DataTypeCategory.LossOfFunction;
    case DataType.WES:
    case DataType.WGS:
    case DataType.RNASeq:
      return DataTypeCategory.OMICS;
    case DataType.PRISMOncRef:
    case DataType.PRISMRepurposing:
      return DataTypeCategory.CompoundViability;
    default:
      return DataTypeCategory.Subtype;
  }
}

/* Gene Dependency and Drug Sensitivity Tabs */

export enum ContextAnalysisPlotType {
  inVsOut,
  TTest,
}

export interface ContextAnalysisPlotData {
  indexLabels: string[];
  selectivityVal: number[];
  tTest: {
    x: {
      axisLabel: string;
      values: number[];
    };
    y: {
      axisLabel: string;
      values: number[];
    };
  };
  inVsOut: {
    x: {
      axisLabel: string;
      values: number[];
    };
    y: {
      axisLabel: string;
      values: number[];
    };
  };
}

export interface ContextAnalysisTableRow {
  entity: string;
  tTestQVal: number;
  inContextMean: number;
  outGroupMean: number;
  effectSize: number;
  fractionInContextLinesDependent?: number; // only valid for genes
  fractionOutGroupLinesDependent?: number; // only valid for genes
  selectivityVal: number;
}

export interface BoxPlotInfo {
  name: string;
  hoverLabels: string[];
  xVals: number[];
  color: { r: number; b: number; g: number; a?: number };
  lineColor: string;
  pointLineColor?: string;
  code?: string;
}

export interface OtherSignificantBoxCardData {
  [key: string]: {
    levelZeroPlotInfo: BoxPlotInfo | undefined;
    subContextInfo: BoxPlotInfo[];
  };
}

export enum TabTypes {
  Overview = 0,
  GeneDependency = 1,
  DrugSensitivityRepurposing = 2,
  DrugSensitivityOncRef = 3,
}

export enum TreeType {
  Lineage = "Lineage",
  MolecularSubtype = "MolecularSubtype",
}
