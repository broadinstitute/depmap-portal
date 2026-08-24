// Persist-enabled wrappers for methods whose responses depend on datasets the
// request itself does not name. The engine would refuse `persist: true` for
// these (no dataset address in the cache key), so each wrapper computes the
// response's implicit dependencies — the metadata datasets behind the
// dimension types involved — and declares them via `persist: { deps }`.
// Breadbox guarantees dimension-type metadata datasets are always in the
// public group and get a new UUID whenever their contents change (see
// breadbox/service/dataset.py), so the declared deps are exact: a metadata
// update changes the dep, which changes the key, which orphans the old entry.
//
// Both wrappers FALL BACK to plain in-memory caching whenever the dep set
// cannot be fully enumerated. A fallback costs a cache hit, never correctness.

import type { DataExplorerContextV2 } from "@depmap/types";
import { breadboxAPI } from "./breadboxAPI";
import { cached } from "./apiCacheDecorator";

type NamelessContext = Omit<DataExplorerContextV2, "name">;

// Resolve dimension type names to their metadata dataset UUIDs, or null if any
// of them can't be resolved (unknown type, or no metadata dataset).
async function resolveMetadataDatasetIds(
  names: string[]
): Promise<string[] | null> {
  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const ids: string[] = [];

  for (const name of names) {
    const id = dimensionTypes.find((t) => t.name === name)?.metadata_dataset_id;

    if (!id) {
      return null;
    }

    ids.push(id);
  }

  return ids;
}

/**
 * Unfiltered identifiers for a dimension type, persisted across reloads.
 *
 * Deliberately takes no filter params: the `data_type` /
 * `show_only_dimensions_in_datasets` variants are access-filtered per user on
 * the backend and must never be persisted. Call
 * `cached(breadboxAPI).getDimensionTypeIdentifiers(...)` directly for those.
 */
export async function getDimensionTypeIdentifiersPersisted(
  dimTypeName: string
) {
  const deps = await resolveMetadataDatasetIds([dimTypeName]);

  return deps
    ? cached(breadboxAPI, { persist: { deps } }).getDimensionTypeIdentifiers(
        dimTypeName
      )
    : cached(breadboxAPI).getDimensionTypeIdentifiers(dimTypeName);
}

// Collect the dimension types whose metadata datasets a context result depends
// on: the context's own and those of nested contexts, recursively. Returns
// null when the dep set can't be fully enumerated — a var with
// `reindex_through` maps between dimension spaces through metadata datasets
// the request doesn't name.
//
// This walk must NEVER throw. Contexts arrive here from interactive editors
// that evaluate partially-built trees (holes, undefined nested entries), and
// throwing here is a behavior change from the plain `evaluateContext` call
// this wraps. Anything malformed returns null, which downgrades to plain
// in-memory caching — the request then succeeds or fails exactly as it did
// before persistence existed.
function collectDimensionTypeNames(context: NamelessContext): string[] | null {
  const names = new Set<string>();
  const queue: NamelessContext[] = [context];

  for (let i = 0; i < queue.length; i += 1) {
    const c = queue[i];

    if (!c || typeof c.dimension_type !== "string") {
      return null;
    }

    names.add(c.dimension_type);

    for (const variable of Object.values(c.vars || {})) {
      if (!variable || variable.reindex_through !== undefined) {
        return null;
      }
    }

    if (c.contexts) {
      queue.push(...Object.values(c.contexts));
    }
  }

  return Array.from(names);
}

/**
 * Evaluate a context, persisting the result across reloads when its full
 * dependency set can be determined.
 *
 * The datasets named by the context's vars are already part of the cache key
 * (the POST body is the key), so the declared deps only need the implicit
 * dependencies: the metadata dataset of the context's dimension type and of
 * every nested context's dimension type. The engine independently requires
 * every one of those datasets to be public, or the result is not persisted.
 */
export async function evaluateContextPersisted(context: NamelessContext) {
  const names = collectDimensionTypeNames(context);
  const deps = names ? await resolveMetadataDatasetIds(names) : null;

  return deps
    ? cached(breadboxAPI, { persist: { deps } }).evaluateContext(context)
    : cached(breadboxAPI).evaluateContext(context);
}
