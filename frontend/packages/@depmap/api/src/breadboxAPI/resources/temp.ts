import {
  DatasetAssociations,
  DataExplorerContextV2,
  SliceQuery,
} from "@depmap/types";
import { postJson } from "../client";
import { getTabularDatasetData } from "./datasets";
import { getDimensionTypeIdentifiers } from "./types";

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
    window.console.warn("sliceQuery:", sliceQuery);
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

  const response = await postJson<
    | {
        ids: string[];
        labels: string[];
        num_candidates: number;
      }
    // WORKAROUND: Errors result in a code 200 like regular responses.
    // We'll look for detail property to detect them.
    // FIXME: Figure out why Breadbox doesn't respond with an error! It's
    // formatted like one.
    | {
        detail: {
          message: string;
          error_type: string;
        };
      }
  >("/temp/context", context);

  if ("detail" in response) {
    window.console.warn("Could not evaluate context", context);
    throw new Error(JSON.stringify(response.detail, null, 2));
  }

  return response;
}
