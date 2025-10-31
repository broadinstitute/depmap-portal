import {
  ContextAnalysisTableType,
  ContextExplorerDatasets,
  ContextInfo,
  ContextPathInfo,
  ContextPlotBoxData,
  DataTypeCategory,
  DoseCurveData,
  EnrichedLineagesTileData,
  SearchOptionsByTreeType,
} from "@depmap/types";
import { getJson } from "../client";

enum DataType {
  PRISMRepurposing,
  PRISMOncRef,
  RNASeq,
  WGS,
  WES,
  RNAi,
  CRISPR,
  default,
}

interface Summary {
  all_depmap_ids: [number, string][];
  data_types: string[];
  values: boolean[][];
}

interface AvailabilitySummary {
  summary: Summary;
  table: { [key: string]: string | boolean }[];
}

function getDataTypeColorCategoryFromDataTypeValue(
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

export async function getContextDataAvailability(tree_type: string) {
  const summaryAndTable = await getJson<AvailabilitySummary>(
    `/api/context_explorer/context_summary`,
    { tree_type }
  );

  const boolSummary = summaryAndTable.summary;
  const table = summaryAndTable.table;

  const dataAvailVals = boolSummary.values.map(
    (datatypeVals: boolean[], index: number) =>
      datatypeVals.map((val: boolean) => {
        const dType =
          DataType[boolSummary.data_types[index] as keyof typeof DataType];
        return getDataTypeColorCategoryFromDataTypeValue(dType, val);
      })
  );

  const contextSummary = {
    all_depmap_ids: boolSummary.all_depmap_ids,
    data_types: boolSummary.data_types,
    // The original True/False values returned from the backend are
    // mapped to color category integers. The integer maps to Heatmap.tsx's
    // color scale.
    values: dataAvailVals,
  };

  return {
    summary: contextSummary,
    table,
  };
}

export function getContextExplorerAnalysisData(
  in_group_code: string,
  out_group_type: string,
  feature_type: string,
  dataset_given_id: ContextExplorerDatasets
) {
  const params = {
    in_group: in_group_code,
    out_group_type,
    feature_type,
    dataset_given_id,
  };

  return getJson<ContextAnalysisTableType>(
    "/api/context_explorer/analysis_data",
    params
  );
}

export function getContextExplorerBoxPlotData(
  selected_subtype_code: string,
  tree_type: string,
  dataset_given_id: ContextExplorerDatasets,
  feature_type: string,
  feature_id: string,
  max_fdr: number,
  min_abs_effect_size: number,
  min_frac_dep_in: number,
  doShowPositiveEffectSizes: boolean
) {
  return getJson<ContextPlotBoxData>(
    "/api/context_explorer/context_box_plot_data",
    {
      selected_subtype_code,
      tree_type,
      dataset_given_id,
      out_group: "All Others",
      feature_type,
      feature_id,
      max_fdr,
      min_abs_effect_size,
      min_frac_dep_in,
      show_positive_effect_sizes: doShowPositiveEffectSizes,
    }
  );
}

export function getContextExplorerContextInfo(subtypeCode: string) {
  return getJson<ContextInfo>(`/api/context_explorer/context_info`, {
    level_0_subtype_code: subtypeCode,
  });
}

export function getContextExplorerDoseResponsePoints(
  datasetGivenId: string,
  subtypeCode: string,
  outGroupType: string,
  featureId: string,
  selectedLevel: number,
  treeType: string
) {
  return getJson<DoseCurveData>("/api/context_explorer/context_dose_curves", {
    dataset_given_id: datasetGivenId,
    subtype_code: subtypeCode,
    feature_id: featureId,
    level: selectedLevel,
    out_group_type: outGroupType,
    tree_type: treeType,
  });
}

export function getContextPath(selectedCode: string) {
  return getJson<ContextPathInfo>(`/api/context_explorer/context_path`, {
    selected_code: selectedCode,
  });
}

export function getContextSearchOptions() {
  return getJson<SearchOptionsByTreeType>(
    "/api/context_explorer/context_search_options"
  );
}

export function getEnrichmentTileData(
  treeType: string,
  featureType: string,
  featureId: string
) {
  return getJson<EnrichedLineagesTileData>(
    "/api/context_explorer/enriched_lineages_tile",
    {
      tree_type: treeType,
      feature_type: featureType,
      feature_id: featureId,
    }
  );
}

export function getNodeName(subtypeCode: string) {
  return getJson<string>("/api/context_explorer/context_node_name", {
    subtype_code: subtypeCode,
  });
}

export async function getSubtypeDataAvailability(selectedCode: string) {
  const subtypeDataAvail = await getJson<Summary>(
    "/api/context_explorer/subtype_data_availability",
    {
      selected_code: selectedCode,
    }
  );

  const dataAvailVals = subtypeDataAvail.values.map(
    (datatypeVals: boolean[], index: number) =>
      datatypeVals.map((val: boolean) => {
        const dType =
          DataType[subtypeDataAvail.data_types[index] as keyof typeof DataType];
        return getDataTypeColorCategoryFromDataTypeValue(dType, val);
      })
  );

  return {
    all_depmap_ids: subtypeDataAvail.all_depmap_ids,
    data_types: subtypeDataAvail.data_types,
    values: dataAvailVals,
  };
}
