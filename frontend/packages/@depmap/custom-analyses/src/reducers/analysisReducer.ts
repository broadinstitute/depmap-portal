import {
  AnalysisConfiguration,
  PearsonCorrelationConfiguration,
  TwoClassComparisonConfiguration,
} from "../types/AnalysisConfiguration";

export type AnalysisReducerAction =
  | {
      type: "select_kind";
      payload: AnalysisConfiguration["kind"];
    }
  | {
      type: "select_data_source";
      payload: AnalysisConfiguration["dataSource"];
    }
  | {
      type: "select_dataset_id";
      payload: AnalysisConfiguration["datasetId"] | undefined;
    }
  | {
      type: "select_custom_dataset_filename";
      payload: AnalysisConfiguration["customDatasetFilename"] | undefined;
    }
  | {
      type: "select_slice_source";
      payload: PearsonCorrelationConfiguration["sliceSource"];
    }
  | {
      type: "select_slice_query";
      payload: PearsonCorrelationConfiguration["sliceQuery"] | undefined;
    }
  | {
      type: "select_custom_slice_filename";
      payload:
        | PearsonCorrelationConfiguration["customSliceFilename"]
        | undefined;
    }
  | {
      type: "select_unfiltered";
      payload: PearsonCorrelationConfiguration["unfiltered"];
    }
  | {
      type: "select_filter_by_context";
      payload: PearsonCorrelationConfiguration["filterByContext"];
    }
  | {
      type: "select_in_group_context";
      payload: TwoClassComparisonConfiguration["inGroupContext"] | undefined;
    }
  | {
      type: "select_use_all_others";
      payload: TwoClassComparisonConfiguration["useAllOthers"];
    }
  | {
      type: "select_out_group_context";
      payload: TwoClassComparisonConfiguration["outGroupContext"];
    }
  // Use this to dispatch multiple actions
  // as if they were a single logical action.
  | { type: "batch"; payload: AnalysisReducerAction[] };

export function analysisReducer(
  analysis: Partial<AnalysisConfiguration>,
  action: AnalysisReducerAction
): Partial<AnalysisConfiguration> {
  switch (action.type) {
    case "select_kind": {
      if (action.payload === analysis.kind) {
        return analysis;
      }

      if (action.payload === "pearson_correlation") {
        return {
          kind: "pearson_correlation",
          index_type: analysis.index_type || "depmap_model",
          dataSource: "portal_data",
          datasetId: undefined,
          sliceSource: "portal_data",
          sliceQuery: undefined,
          unfiltered: true,
          filterByContext: undefined,
        };
      }

      return {
        kind: "two_class_comparison",
        index_type: analysis.index_type || "depmap_model",
        dataSource: "portal_data",
        datasetId: undefined,
        inGroupContext: undefined,
        useAllOthers: true,
        outGroupContext: undefined,
      };
    }

    case "select_data_source": {
      return {
        ...analysis,
        datasetId: undefined,
        dataSource: action.payload,
      };
    }

    case "select_dataset_id": {
      return { ...analysis, datasetId: action.payload };
    }

    case "select_custom_dataset_filename": {
      return { ...analysis, customDatasetFilename: action.payload };
    }

    case "select_slice_source": {
      if (analysis.kind !== "pearson_correlation") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      const sliceSource = action.payload;

      if (analysis.sliceSource === sliceSource) {
        return analysis;
      }

      return { ...analysis, sliceSource, sliceQuery: undefined };
    }

    case "select_slice_query": {
      if (analysis.kind !== "pearson_correlation") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return { ...analysis, sliceQuery: action.payload };
    }

    case "select_custom_slice_filename": {
      if (analysis.kind !== "pearson_correlation") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return {
        ...analysis,
        customSliceFilename: action.payload,
      };
    }

    case "select_unfiltered": {
      if (analysis.kind !== "pearson_correlation") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return {
        ...analysis,
        filterByContext: undefined,
        unfiltered: action.payload,
      };
    }

    case "select_filter_by_context": {
      if (analysis.kind !== "pearson_correlation") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return {
        ...analysis,
        unfiltered: false,
        filterByContext: action.payload,
      };
    }

    case "select_in_group_context": {
      if (analysis.kind !== "two_class_comparison") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return { ...analysis, inGroupContext: action.payload };
    }

    case "select_use_all_others": {
      if (analysis.kind !== "two_class_comparison") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return {
        ...analysis,
        useAllOthers: action.payload,
        outGroupContext: undefined,
      };
    }

    case "select_out_group_context": {
      if (analysis.kind !== "two_class_comparison") {
        throw new Error(
          `Unsupported action type "${action.type}" for kind "${analysis.kind}"`
        );
      }

      return {
        ...analysis,
        useAllOthers: false,
        outGroupContext: action.payload,
      };
    }

    case "batch": {
      const thisReducer = analysisReducer as (
        analysis: Partial<AnalysisConfiguration>,
        action: AnalysisReducerAction
      ) => Partial<AnalysisConfiguration>;

      return action.payload.reduce(thisReducer, analysis);
    }

    default:
      throw new Error(`Unknown action: "${(action as { type: string }).type}"`);
  }
}
