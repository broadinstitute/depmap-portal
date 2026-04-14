import { DataExplorerContextV2, SliceQuery } from "@depmap/types";

type CtxLike = Pick<DataExplorerContextV2, "expr" | "vars" | "contexts">;

/**
 * Walk a context and its embedded contexts, producing one SliceQuery chain
 * per leaf data reference. Each chain has the leaf slice at the root with
 * `reindex_through` stepping back toward the outer context's dimension_type.
 *
 * For a screen_pair context whose rule is
 *   "screen(TestArmScreenID) in {screens where KRAS CN >= 1}"
 * the result is a single chain:
 *   KRAS feature_id
 *     → reindex_through: ModelID column
 *       → reindex_through: TestArmScreenID column
 */
export function contextToReindexChains(ctx: CtxLike): SliceQuery[] {
  const out: SliceQuery[] = [];
  walk(ctx, [], out);
  return out;
}

function walk(
  ctx: CtxLike,
  pathFromRoot: SliceQuery[],
  out: SliceQuery[]
): void {
  visitVarUsages(ctx.expr, (varKey, usage) => {
    const raw = ctx.vars?.[varKey];
    if (!raw) return;

    if (usage.kind === "link") {
      const sub = ctx.contexts?.[usage.contextHash];
      if (!sub) return;
      const linkSlice = normalizeSlice(raw, { stripReindex: true });
      if (!linkSlice) return;
      walk(sub, [...pathFromRoot, linkSlice], out);
    } else {
      const leaf = normalizeSlice(raw, { stripReindex: false });
      if (!leaf) return;
      out.push(buildChain(leaf, pathFromRoot));
    }
  });
}

function normalizeSlice(
  v: Partial<SliceQuery> & { slice_type?: string | null },
  opts: { stripReindex: boolean }
): SliceQuery | null {
  if (!v.dataset_id || !v.identifier || !v.identifier_type) return null;
  // Mirror the existing edge case: for null slice_type, feature_id and
  // feature_label refer to the same thing, so normalize to feature_id.
  const identifier_type =
    v.slice_type === null ? "feature_id" : v.identifier_type;
  const sq: SliceQuery = {
    dataset_id: v.dataset_id,
    identifier: v.identifier,
    identifier_type,
  } as SliceQuery;
  if (!opts.stripReindex && v.reindex_through) {
    // @typescript-eslint/no-explicit-any
    (sq as any).reindex_through = v.reindex_through;
  }
  return sq;
}

function buildChain(leaf: SliceQuery, pathFromRoot: SliceQuery[]): SliceQuery {
  // pathFromRoot is [outermost link, ..., innermost link]. Wrap inward so
  // the innermost link sits closest to the leaf data.
  let rt: SliceQuery | undefined;
  for (const link of pathFromRoot) {
    rt = { ...link, reindex_through: rt };
  }
  if (!rt) return leaf;
  // If the leaf already had its own reindex_through, attach the new chain
  // at the bottom rather than overwriting.
  return attachAtBottom(leaf, rt);
}

function attachAtBottom(slice: SliceQuery, tail: SliceQuery): SliceQuery {
  if (!slice.reindex_through) return { ...slice, reindex_through: tail };
  return {
    ...slice,
    reindex_through: attachAtBottom(slice.reindex_through as SliceQuery, tail),
  };
}

type VarUsage = { kind: "link"; contextHash: string } | { kind: "leaf" };

function visitVarUsages(
  // @typescript-eslint/no-explicit-any
  node: any,
  visit: (varKey: string, usage: VarUsage) => void
): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const entries = Object.entries(node);
  if (entries.length !== 1) return;
  const [op, rawArgs] = entries[0];
  if (op === "var" || op === "context") return;

  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  if (op === "and" || op === "or" || op === "!") {
    args.forEach((n) => visitVarUsages(n, visit));
    return;
  }

  let varKey: string | null = null;
  let contextHash: string | null = null;
  for (const a of args) {
    if (a && typeof a === "object" && !Array.isArray(a)) {
      // @typescript-eslint/no-explicit-any
      if ("var" in a && varKey == null) varKey = String((a as any).var);
      else if ("context" in a && contextHash == null) {
        // @typescript-eslint/no-explicit-any
        contextHash = String((a as any).context);
      }
    }
  }
  if (varKey == null) return;
  visit(
    varKey,
    contextHash != null ? { kind: "link", contextHash } : { kind: "leaf" }
  );
}
