export interface ContextNode {
  name: string;
  node_level: number;
  subtype_code: string;
  parent_subtype_code: string | null;
  model_ids: string[];
  path: string[];
  children: ContextNode[];
}

export interface ContextInfo {
  tree: ContextNode;
  table_data: { [key: string]: string | boolean }[];
}

export enum ContextExplorerDatasets {
  Chronos_Combined = "Chronos_Combined",
  Rep_all_single_pt = "Rep_all_single_pt",
  Prism_oncology_AUC = "Prism_oncology_AUC",
}

export interface ContextPathInfo {
  path: string[];
  tree_type: string;
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

export interface BoxData {
  label: string;
  path: string[];
  data: number[];
  cell_line_display_names: string[];
}

export interface BoxCardData {
  significant: BoxData[];
  insignificant: BoxData;
  level_0_code: string;
}

export interface ContextPlotBoxData {
  significant_selection: BoxData[] | null;
  insignificant_selection: BoxData | null;
  other_cards: BoxCardData[];
  insignificant_heme_data: BoxData;
  insignificant_solid_data: BoxData;
  drug_dotted_line: number;
  entity_label: string;
  entity_overview_page_label: string;
}

export interface ContextNameInfo {
  name: string;
  subtype_code: string;
  node_level: number;
  // Only optional for generic "All Others" context
  numModels?: number;
}

export interface SearchOptionsByTreeType {
  lineage: ContextNameInfo[];
  molecularSubtype: ContextNameInfo[];
}

export interface EnrichedLineagesTileData {
  box_plot_data: ContextPlotBoxData;
  top_context_name_info: ContextNameInfo | null;
  selected_context_name_info: ContextNameInfo | null;
  dataset_name: string;
  dataset_display_name: string;
  context_explorer_url: string;
}

export enum DataTypeCategory {
  LossOfFunction = 1,
  OMICS = 2,
  CompoundViability = 3,
  Subtype = 4,
}
