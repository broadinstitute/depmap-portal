export enum ContextExplorerDatasets {
  Chronos_Combined = "Chronos_Combined",
  Rep_all_single_pt = "Rep_all_single_pt",
  Prism_oncology_AUC = "Prism_oncology_AUC",
}

export interface ContextNode {
  name: string;
  node_level: number;
  subtype_code: string;
  parent_subtype_code: string | null;
  model_ids: string[];
  children: ContextNode[];
}

export interface ContextExplorerTree {
  root: ContextNode;
  children: ContextNode[];
}

export interface ContextNameInfo {
  name: string;
  subtype_code: string;
  node_level: number;
}

export interface ContextInfo {
  trees: { [key: string]: ContextExplorerTree };
  table_data: { [key: string]: string | boolean }[];
  search_options: ContextNameInfo[];
}

export interface Summary {
  all_depmap_ids: [number, string][];
  data_types: string[];
  values: boolean[][];
}

export interface ContextSummary {
  all_depmap_ids: [number, string][];
  data_types: string[];
  values: number[][];
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
  subtype: string;
  molecularSubtype: string;
  crispr: string;
  rnai: string;
  wgs: string;
  wes: string;
  prism: string;
}

export enum DataType {
  PRISM,
  RNASeq,
  WGS,
  WES,
  RNAi,
  CRISPR,
}

export enum DataTypeStrings {
  PRISM = "PRISM",
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
}

export function getDataTypeColorCategoryFromDataTypeValue(
  datatype: DataType,
  cellLineAvailable: boolean
) {
  if (!cellLineAvailable) {
    return 0;
  }

  switch (datatype) {
    case DataType.CRISPR:
    case DataType.RNAi:
      return DataTypeCategory.LossOfFunction;
    case DataType.WES:
    case DataType.WGS:
    case DataType.RNASeq:
      return DataTypeCategory.OMICS;
    case DataType.PRISM:
      return DataTypeCategory.CompoundViability;
    default:
      throw new Error(`Cannot map datatype ${datatype} to color category`);
  }
}

/* Gene Dependency and Drug Sensitivity Tabs */

export enum ContextAnalysisPlotType {
  inVsOut,
  TTest,
}

export enum OutGroupType {
  All = "All",
  Lineage = "Lineage",
  Type = "Type",
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

export type ContextAnalysisTableType = {
  entity: string[];
  t_pval: number[];
  mean_in: number[];
  mean_out: number[];
  effect_size: number[];
  abs_effect_size: number[];
  t_qval: number[];
  t_qval_log: number[];
  n_dep_in: number[];
  n_dep_out: number[];
  frac_dep_in: number[];
  frac_dep_out: number[];
  selectivity_val: number[];
  depletion: string[];
  label: string[];
};

export enum BoxPlotTypes {
  SelectedLineage = "SelectedLineage",
  SelectedPrimaryDisease = "SelectedPrimaryDisease",
  SameLineage = "SameLineage",
  SameLineageType = "SameLineageType",
  OtherLineageType = "OtherLineageType",
  Other = "Other",
}

export type ContextPlotBoxData = {
  box_plot_data: {
    type: BoxPlotTypes;
    data: number[];
    cell_line_display_names: string[];
  }[];
  other_context_dependencies: {
    name: string;
    type: BoxPlotTypes;
    data: number[];
    cell_line_display_names: string[];
  }[];
  drug_dotted_line: number;
  entity_label: string;
};

export enum TabTypes {
  Overview = 0,
  GeneDependency = 1,
  DrugSensitivity = 2,
}

export enum ContextSelectionTabTypes {
  Lineage = 0,
  MolecularSubtype = 1,
}
