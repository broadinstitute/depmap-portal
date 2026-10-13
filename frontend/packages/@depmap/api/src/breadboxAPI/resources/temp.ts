import {
  DatasetAssociations,
  DataExplorerContextV2,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
  SliceQuery,
} from "@depmap/types";
import { getJson, postJson } from "../client";
import { getTabularDatasetData } from "./datasets";
import { getDimensionTypeIdentifiers } from "./types";

// Correlates every feature in `datasetId` against the profile named by
// `sliceQuery` (which may live in a different dataset entirely). Distinct
// from fetchAssociations: that one queries precomputed associations for a
// slice; this one computes on the fly for an arbitrary reference profile.
export async function computeAssociations(
  datasetId: string,
  sliceQuery: SliceQuery
) {
  return postJson<{ label: string[]; given_id: string[]; cor: number[] }>(
    "/temp/associations/compute",
    {
      dataset_id: datasetId,
      slice_query: sliceQuery,
    }
  );
}

// One entry in the content-addressable store (used for contexts, among other
// things). `value` is a JSON string.
export async function getCasValue(hash: string) {
  return getJson<{ value: string }>(`/temp/cas/${hash}`);
}

// Data behind a plot config, assembled server-side (see ADR 0010). The config
// can be in any shape a client has ever produced (`version` attached); the
// server normalizes it and returns the result as `data.plot_config`. `data`
// also carries `linreg_by_group` when the config asks for a regression line.
export async function getPlotData(plotConfig: object) {
  return postJson<{
    api_version: number;
    data: DataExplorerPlotResponse & {
      plot_config: DataExplorerPlotConfig;
      linreg_by_group?: LinRegInfo[];
    };
  }>("/temp/plot-data", { api_version: 1, plot_config: plotConfig });
}

export async function fetchAssociations(
  sliceQuery: SliceQuery,
  associatedDatasetIds?: string[]
) {
  const result = await postJson<DatasetAssociations>(
    "/temp/associations/query-slice",
    {
      slice_query: sliceQuery,
      association_datasets: associatedDatasetIds,
    }
  );

  if ("detail" in result) {
    console.warn("sliceQuery:", sliceQuery);
    throw new Error(JSON.stringify(result.detail));
  }

  return result;
}

type InLiteralExpr = {
  in: [{ var: string }, ReadonlyArray<string | number | boolean>];
};

type NamelessContext = Omit<DataExplorerContextV2, "name">;
type LocallyEvaluableContext = Omit<NamelessContext, "expr"> & {
  expr: InLiteralExpr;
};

/**
 * Allowlist gate for in-browser context evaluation. Returns true ONLY for
 * shapes whose local result is provably identical to the backend's
 * /temp/context result. Default-deny: anything not explicitly certified here
 * falls through to the backend. Adding a locally-handled shape means adding a
 * branch — never loosening the default. (This is what was wrong before: the
 * old guard was a blocklist, so every new backend feature silently broke it.)
 */
function canEvaluateLocally(
  context: NamelessContext
): context is LocallyEvaluableContext {
  const { expr, vars } = context;

  // Shape: a single top-level `in(var, [literals])` — the only form the local
  // membership handler knows how to evaluate.
  const isSingleInLiteral =
    typeof expr !== "boolean" && "in" in expr && Array.isArray(expr.in[1]);
  if (!isSingleInLiteral) return false;

  // The local handler only supports a single variable today.
  if (Object.keys(vars).length !== 1) return false;

  // Dimension-space safety (the load-bearing check): every var must already be
  // indexed in the context's own dimension_type. `reindex_through` means the
  // var's values live in a leaf dimension and only reach dimension_type by
  // fanning out across an FK — backend-only work — so its presence
  // disqualifies local evaluation. `.every` (not `[0]`) states the real intent
  // and stays safe if the single-var rule is ever relaxed.
  const allVarsInTargetSpace = Object.values(vars).every(
    (v) => v.reindex_through === undefined
  );
  if (!allVarsInTargetSpace) return false;

  return true;
}

export async function evaluateContext(context: NamelessContext) {
  // Fast path: evaluate certified-simple contexts in-browser to skip the
  // /temp/context round-trip during interactive filtering. The gate is an
  // allowlist — see canEvaluateLocally. Everything it doesn't certify,
  // including anything with reindex_through, nested {context} refs,
  // complements, or null ops, goes to the backend, which is the source of
  // truth for those semantics.
  if (canEvaluateLocally(context)) {
    const slice = Object.values(context.vars)[0];

    if (slice.identifier_type === "column") {
      const [colData, identifiers] = await Promise.all([
        getTabularDatasetData(slice.dataset_id, {
          columns: [slice.identifier],
        }),
        getDimensionTypeIdentifiers(context.dimension_type),
      ]);

      const labelMap: Record<string, string> = {};

      for (const { id, label } of identifiers) {
        labelMap[id] = label;
      }

      const valuesToMatch = new Set(context.expr.in[1]);
      const idValuePairs = Object.entries(colData[slice.identifier]);

      const ids = [] as string[];
      const labels = [] as string[];

      for (const [id, value] of idValuePairs) {
        if (valuesToMatch.has(value)) {
          ids.push(id);
          labels.push(labelMap[id]);
        }
      }

      return { ids, labels, num_candidates: idValuePairs.length };
    }
  }

  return postJson<{
    ids: string[];
    labels: string[];
    num_candidates: number;
  }>("/temp/context", context);
}

// How many of a context's entities each dataset actually contains.
//
// Exists so the Data Version select can offer a dataset that has the data
// rather than the highest-priority one for the slice type, which with sparse
// data is often a dataset containing none of it. The context is evaluated
// server-side, so this is one round trip regardless of how many entities the
// context names — asking `getDatasets({ feature_id })` per entity is a round
// trip each, and a context routinely names thousands.
//
// Datasets matching nothing are absent from `counts` rather than present with
// a zero, so a caller wanting the zeroes fills them in from its own dataset
// list.
//
// `scope: "public"` counts over the public group only, which makes the answer
// the same for every user and so safe to persist — the caller trades coverage
// information about its private datasets for a response that survives a
// reload. Pass it together with `persist: { publicCatalog: true }`; neither is
// correct without the other. The scope rides in the URL rather than the body
// because the body is the frozen DE2 context format, and because the cache key
// is built from URL plus body, which keeps the two scopes on disjoint keys.
export async function getContextDatasetCoverage(
  context: NamelessContext,
  scope: "all" | "public" = "all"
) {
  return postJson<{ counts: Record<string, number>; total: number }>(
    `/temp/context/dataset-coverage?scope=${scope}`,
    context
  );
}
