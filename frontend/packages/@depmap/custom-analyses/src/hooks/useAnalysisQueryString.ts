import { useEffect, useCallback, useRef, useState } from "react";
import qs from "qs";
import {
  fetchContext,
  persistContext,
  isNegatedContext,
  negateContext,
} from "@depmap/data-explorer-2";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  AnalysisConfiguration,
  PearsonCorrelationConfiguration,
  TwoClassComparisonConfiguration,
} from "../types/AnalysisConfiguration";
import {
  analysisReducer,
  AnalysisReducerAction,
} from "../reducers/analysisReducer";
import isCompleteAnalysisConfig from "../utils/isCompleteAnalysisConfig";

const DEFAULTS = {
  index_type: "depmap_model",
  dataSource: "portal_data",
  sliceSource: "portal_data",
  unfiltered: true,
} as const;

const CONTEXT_KEYS = [
  "filterByContext",
  "inGroupContext",
  "outGroupContext",
] as const;

const CONTEXT_SIZE_THRESHOLD = 500;

type ContextDescriptor = {
  hash: string;
  negated: boolean;
};

function isContextDescriptor(value: unknown): value is ContextDescriptor {
  return (
    typeof value === "object" &&
    value !== null &&
    "hash" in value &&
    typeof (value as ContextDescriptor).hash === "string" &&
    "negated" in value &&
    typeof (value as ContextDescriptor).negated === "boolean"
  );
}

function buildActionsFromConfig(
  config: AnalysisConfiguration
): AnalysisReducerAction[] {
  const actions: AnalysisReducerAction[] = [];

  actions.push({ type: "select_kind", payload: config.kind });
  actions.push({ type: "select_data_source", payload: config.dataSource });
  actions.push({ type: "select_dataset_id", payload: config.datasetId });

  if (config.customDatasetFilename) {
    actions.push({
      type: "select_custom_dataset_filename",
      payload: config.customDatasetFilename,
    });
  }

  if (config.kind === "pearson_correlation") {
    const pearson = config as PearsonCorrelationConfiguration;

    actions.push({ type: "select_slice_source", payload: pearson.sliceSource });
    actions.push({ type: "select_slice_query", payload: pearson.sliceQuery });

    if (pearson.customSliceFilename) {
      actions.push({
        type: "select_custom_slice_filename",
        payload: pearson.customSliceFilename,
      });
    }

    if (pearson.unfiltered) {
      actions.push({ type: "select_unfiltered", payload: true });
    } else if (pearson.filterByContext) {
      actions.push({
        type: "select_filter_by_context",
        payload: pearson.filterByContext,
      });
    }
  }

  if (config.kind === "two_class_comparison") {
    const twoClass = config as TwoClassComparisonConfiguration;

    actions.push({
      type: "select_in_group_context",
      payload: twoClass.inGroupContext,
    });

    if (twoClass.useAllOthers) {
      actions.push({ type: "select_use_all_others", payload: true });
    } else if (twoClass.outGroupContext) {
      actions.push({
        type: "select_out_group_context",
        payload: twoClass.outGroupContext,
      });
    }
  }

  return actions;
}

function applyDefaults(
  parsed: Partial<AnalysisConfiguration>
): Partial<AnalysisConfiguration> {
  const base = {
    ...parsed,
    index_type: parsed.index_type ?? DEFAULTS.index_type,
    dataSource: parsed.dataSource ?? DEFAULTS.dataSource,
  };

  if (parsed.kind === "pearson_correlation") {
    const pearson = parsed as Partial<PearsonCorrelationConfiguration>;
    return {
      ...base,
      kind: "pearson_correlation",
      sliceSource: pearson.sliceSource ?? DEFAULTS.sliceSource,
      unfiltered: pearson.unfiltered ?? DEFAULTS.unfiltered,
    } as Partial<PearsonCorrelationConfiguration>;
  }

  return base;
}

function stripDefaults(
  config: AnalysisConfiguration
): Partial<AnalysisConfiguration> {
  const result: Partial<AnalysisConfiguration> = { ...config };

  if (result.index_type === DEFAULTS.index_type) {
    delete result.index_type;
  }

  if (result.dataSource === DEFAULTS.dataSource) {
    delete result.dataSource;
  }

  if (
    config.kind === "pearson_correlation" &&
    config.sliceSource === DEFAULTS.sliceSource
  ) {
    delete (result as Partial<PearsonCorrelationConfiguration>).sliceSource;
  }

  return result;
}

async function contextToDescriptor(
  context: DataExplorerContextV2
): Promise<DataExplorerContextV2 | ContextDescriptor> {
  const serialized = JSON.stringify(context);

  if (serialized.length <= CONTEXT_SIZE_THRESHOLD) {
    return context;
  }

  const negated = isNegatedContext(context);
  const contextToHash = negated ? negateContext(context) : context;

  return {
    hash: await persistContext(contextToHash),
    negated,
  };
}

async function descriptorToContext(
  value: DataExplorerContextV2 | ContextDescriptor
): Promise<DataExplorerContextV2> {
  if (!isContextDescriptor(value)) {
    return value;
  }

  const context = await fetchContext(value.hash);

  if (value.negated) {
    return negateContext(context as DataExplorerContextV2);
  }

  return context as DataExplorerContextV2;
}

async function serializeContexts(
  config: Partial<AnalysisConfiguration>
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...config };

  await Promise.all(
    CONTEXT_KEYS.map(async (key) => {
      if (key in result && result[key] != null) {
        const context = result[key] as DataExplorerContextV2;
        result[key] = JSON.stringify(await contextToDescriptor(context));
      }
    })
  );

  return result;
}

async function deserializeContexts(
  parsed: Record<string, unknown>
): Promise<Partial<AnalysisConfiguration>> {
  const result: Record<string, unknown> = { ...parsed };

  await Promise.all(
    CONTEXT_KEYS.map(async (key) => {
      if (key in result && typeof result[key] === "string") {
        try {
          const value = JSON.parse(result[key] as string);
          result[key] = await descriptorToContext(value);
        } catch {
          // Invalid JSON — leave as-is, will fail validation
        }
      }
    })
  );

  return result as Partial<AnalysisConfiguration>;
}

function useAnalysisQueryString(
  analysis: Partial<AnalysisConfiguration>,
  dispatch: React.Dispatch<AnalysisReducerAction>
): {
  syncedDispatch: (action: AnalysisReducerAction) => void;
  isHydrating: boolean;
  hydrationError: Error | null;
} {
  const isHydratingRef = useRef(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<Error | null>(null);

  // Hydrate from URL on mount
  useEffect(() => {
    const hydrate = async () => {
      const search = window.location.search.slice(1);

      if (!search) {
        setIsHydrating(false);
        return;
      }

      try {
        const parsed = qs.parse(search, {
          depth: 10,
          decoder(str, defaultDecoder, charset, type) {
            if (type === "value") {
              if (str === "true") return true;
              if (str === "false") return false;
            }
            return defaultDecoder(str, defaultDecoder, charset);
          },
        }) as Record<string, unknown>;

        const deserialized = await deserializeContexts(parsed);
        const withDefaults = applyDefaults(deserialized);

        if (!isCompleteAnalysisConfig(withDefaults)) {
          setIsHydrating(false);
          return;
        }

        isHydratingRef.current = true;

        const actions = buildActionsFromConfig(withDefaults);
        dispatch({ type: "batch", payload: actions });

        requestAnimationFrame(() => {
          isHydratingRef.current = false;
          setIsHydrating(false);
        });
      } catch (error) {
        setHydrationError(
          error instanceof Error ? error : new Error(String(error))
        );
        window.console.error(error);
        setIsHydrating(false);
      }
    };

    hydrate();
  }, [dispatch]);

  // Handle popstate (back/forward)
  useEffect(() => {
    const handlePopState = async (event: PopStateEvent) => {
      const state = event.state as Partial<AnalysisConfiguration> | null;
      if (!state) return;

      try {
        const withDefaults = applyDefaults(state);
        if (!isCompleteAnalysisConfig(withDefaults)) return;

        isHydratingRef.current = true;

        const actions = buildActionsFromConfig(withDefaults);
        dispatch({ type: "batch", payload: actions });

        requestAnimationFrame(() => {
          isHydratingRef.current = false;
        });
      } catch (error) {
        window.console.error("Failed to restore state from history:", error);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dispatch]);

  const syncedDispatch = useCallback(
    (action: AnalysisReducerAction) => {
      dispatch(action);

      if (isHydratingRef.current) return;

      const nextState = analysisReducer(analysis, action);

      if (!isCompleteAnalysisConfig(nextState)) return;

      const compacted = stripDefaults(nextState);

      // Fire-and-forget async URL update
      (async () => {
        try {
          const serialized = await serializeContexts(compacted);

          const queryString = qs.stringify(serialized, {
            skipNulls: true,
            encode: true,
          });

          const newUrl = `${window.location.pathname}?${queryString}`;
          window.history.pushState(compacted, "", newUrl);
        } catch (error) {
          window.console.error("Failed to sync state to URL:", error);
        }
      })();
    },
    [analysis, dispatch]
  );

  return { syncedDispatch, isHydrating, hydrationError };
}

export default useAnalysisQueryString;
