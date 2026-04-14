/* eslint-disable no-continue */
import { SliceQuery } from "@depmap/types";
import type {
  ChainHop,
  ColumnEntry,
  DimensionTypeDescriptor,
  TableDescriptor,
} from "./types";

/**
 * Serializes a SliceQuery to a stable string for use in Set-like comparisons.
 * Two SliceQueries with the same structure produce the same string.
 */
export function serializeSliceQuery(query: SliceQuery): string {
  const parts: string[] = [];
  let current: SliceQuery | undefined = query;

  while (current) {
    parts.push(
      `${current.dataset_id}|${current.identifier}|${current.identifier_type}`
    );
    current = current.reindex_through;
  }

  return parts.join(">");
}

/**
 * A set of SliceQueries using value equality (serialization-based).
 */
export class SliceQuerySet {
  private keys: Set<string>;

  constructor(queries?: Iterable<SliceQuery>) {
    this.keys = new Set<string>();

    if (queries) {
      for (const q of queries) {
        this.keys.add(serializeSliceQuery(q));
      }
    }
  }

  has(query: SliceQuery): boolean {
    return this.keys.has(serializeSliceQuery(query));
  }

  get size(): number {
    return this.keys.size;
  }
}

/**
 * A step in the chain from root (index type) to leaf (selected column).
 * Used as an intermediate representation before nesting into a SliceQuery.
 */
interface ChainStep {
  dataset_id: string;
  identifier: string;
}

/**
 * Resolves the dataset_id to use in a SliceQuery: prefers given_id over id.
 */
function resolveDatasetId(table: {
  id: string;
  given_id: string | null;
}): string {
  return table.given_id || table.id;
}

/**
 * Finds the primary metadata table for a dimension type.
 */
function findPrimaryTable(
  dimType: string,
  tablesByDim: Record<string, TableDescriptor[]>,
  dimTypeMap: Record<string, DimensionTypeDescriptor>
): TableDescriptor | null {
  const metaId = dimTypeMap[dimType]?.metadata_dataset_id;
  if (!metaId) return null;

  const tables = tablesByDim[dimType] ?? [];
  return tables.find((t) => t.id === metaId) ?? null;
}

/**
 * Builds a SliceQuery from the current navigation state.
 *
 * The chain is assembled root-to-leaf as (dataset_id, identifier) pairs,
 * then nested leaf-outward into the SliceQuery structure.
 *
 * @param selectedColumn   The column name the user picked.
 * @param columnEntry      The ColumnEntry if picked from the properties list
 *                         (has autoPath), or null if from a supplemental table.
 * @param hops             Explicit door hops taken by the user.
 * @param supplementalTable  If the user navigated into a supplemental table,
 *                           its descriptor. null otherwise.
 * @param selectedSource   The source table selected in Widget 1.
 * @param index_type       The root dimension type name.
 * @param tablesByDim      All tables grouped by dim type.
 * @param dimTypeMap       Dim type name → descriptor.
 */
export function buildSliceQuery(
  selectedColumn: string,
  columnEntry: ColumnEntry | null,
  hops: ChainHop[],
  supplementalTable: { tableId: string; dimType: string } | null,
  selectedSource: { id: string; given_id: string | null },
  index_type: string,
  tablesByDim: Record<string, TableDescriptor[]>,
  dimTypeMap: Record<string, DimensionTypeDescriptor>
): SliceQuery {
  const chain: ChainStep[] = [];

  // 1. Door hops: explicit FK traversals chosen by the user.
  for (let i = 0; i < hops.length; i++) {
    if (i === 0) {
      // First hop originates from the selected source table at the index type.
      chain.push({
        dataset_id: resolveDatasetId(selectedSource),
        identifier: hops[i].throughCol,
      });
    } else {
      // Subsequent hops originate from the primary table at the previous dim.
      const originDim = hops[i - 1].toDim;
      const table = findPrimaryTable(originDim, tablesByDim, dimTypeMap);
      chain.push({
        dataset_id: table ? resolveDatasetId(table) : originDim,
        identifier: hops[i].throughCol,
      });
    }
  }

  // 2. Auto-path hops from the selected column (one-to-one traversals).
  if (columnEntry && columnEntry.autoPath.length > 0) {
    for (let j = 0; j < columnEntry.autoPath.length; j++) {
      if (j === 0 && hops.length === 0) {
        // First auto-path step with no preceding door hops:
        // originates from the selected source table, not the primary table.
        chain.push({
          dataset_id: resolveDatasetId(selectedSource),
          identifier: columnEntry.autoPath[j].throughCol,
        });
      } else {
        const originDim =
          j === 0
            ? hops[hops.length - 1].toDim
            : columnEntry.autoPath[j - 1].toDim;
        const table = findPrimaryTable(originDim, tablesByDim, dimTypeMap);
        chain.push({
          dataset_id: table ? resolveDatasetId(table) : originDim,
          identifier: columnEntry.autoPath[j].throughCol,
        });
      }
    }
  }

  // 3. Leaf: the selected column itself.
  if (supplementalTable) {
    // Column from a supplemental table.
    const tables = tablesByDim[supplementalTable.dimType] ?? [];
    const table = tables.find((t) => t.id === supplementalTable.tableId);
    chain.push({
      dataset_id: table ? resolveDatasetId(table) : supplementalTable.tableId,
      identifier: selectedColumn,
    });
  } else if (columnEntry) {
    // Column from a primary table (has tableId and tableGivenId).
    chain.push({
      dataset_id: columnEntry.tableGivenId || columnEntry.tableId,
      identifier: selectedColumn,
    });
  } else {
    // Column from a flat list (non-primary source via Widget 1).
    chain.push({
      dataset_id: resolveDatasetId(selectedSource),
      identifier: selectedColumn,
    });
  }

  // 4. Nest: innermost = root (chain[0]), outermost = leaf (chain[last]).
  let query: SliceQuery = {
    dataset_id: chain[0].dataset_id,
    identifier: chain[0].identifier,
    identifier_type: "column",
  };

  for (let i = 1; i < chain.length; i++) {
    query = {
      dataset_id: chain[i].dataset_id,
      identifier: chain[i].identifier,
      identifier_type: "column",
      reindex_through: query,
    };
  }

  return query;
}

/**
 * Flattens a nested SliceQuery into a chain of steps from root to leaf.
 */
export function flattenSliceQuery(query: SliceQuery): ChainStep[] {
  const steps: ChainStep[] = [];
  let current: SliceQuery | undefined = query;

  // Collect leaf-to-root by following reindex_through.
  const reversed: ChainStep[] = [];
  while (current) {
    reversed.push({
      dataset_id: current.dataset_id,
      identifier: current.identifier,
    });
    current = current.reindex_through;
  }

  // Reverse to get root-to-leaf order.
  for (let i = reversed.length - 1; i >= 0; i--) {
    steps.push(reversed[i]);
  }

  return steps;
}

/**
 * Derives a display label from a SliceQuery for showing in the trigger.
 *
 * For a simple query (no reindex_through), shows just the column name.
 * For chains, shows the door-hop columns and leaf column joined by " › ".
 *
 * To properly identify door hops vs auto-traversals, we'd need the full
 * schema. For now, we show the first hop and the leaf, which covers
 * the most common case (one door hop + auto-flattening).
 */
export function displayLabelFromSliceQuery(query: SliceQuery): string {
  const steps = flattenSliceQuery(query);

  if (steps.length <= 1) {
    return query.identifier;
  }

  // Show first hop identifier + leaf identifier.
  // For deeper chains, include intermediate explicit hops if we had
  // cardinality info. For now, first › last is clear enough.
  const first = steps[0].identifier;
  const last = steps[steps.length - 1].identifier;

  return `${first} › ${last}`;
}

/**
 * Derives a display label from the current navigation state at selection time.
 * This has full knowledge of which hops were doors (explicit choices) vs
 * auto-traversals, so it produces the correct collapsed label.
 */
export function displayLabelFromNavState(
  selectedColumn: string,
  hops: ChainHop[],
  supplementalTableName: string | null
): string {
  // Collect door hop throughCols (these are explicit user choices).
  const parts: string[] = hops.map((h) => h.throughCol);

  if (supplementalTableName) {
    parts.push(supplementalTableName);
  }

  parts.push(selectedColumn);

  if (parts.length === 1) {
    return parts[0];
  }

  return parts.join(" › ");
}

/**
 * Find a table across all dim types by dataset_id (matches id or given_id).
 * Returns the table and the dim type it belongs to.
 */
function findTableByDatasetId(
  datasetId: string,
  tablesByDim: Record<string, TableDescriptor[]>
): { table: TableDescriptor; dimType: string } | null {
  for (const [dimType, tables] of Object.entries(tablesByDim)) {
    for (const table of tables) {
      if (table.id === datasetId || table.given_id === datasetId) {
        return { table, dimType };
      }
    }
  }

  return null;
}

/**
 * Navigation state derived from a SliceQuery value.
 */
export interface DerivedNavState {
  sourceTableId: string | null;
  hops: ChainHop[];
  supplementalTable: {
    tableId: string;
    tableName: string;
    dimType: string;
    dimDisplayName: string;
  } | null;
}

/**
 * Derives the navigation state (hops, supplemental table, source) from a
 * SliceQuery value and the loaded schema. This reconstructs the breadcrumb
 * trail so the user sees the same view they had when they made the selection.
 *
 * For each intermediate step in the chain, we check whether the column was
 * a many-to-one FK (door hop) or one-to-one FK (auto-traversal) by counting
 * how many FK columns in the same table reference the same target dim type.
 */
export function deriveNavStateFromValue(
  query: SliceQuery,
  index_type: string,
  tablesByDim: Record<string, TableDescriptor[]>,
  dimTypeMap: Record<string, DimensionTypeDescriptor>
): DerivedNavState {
  const steps = flattenSliceQuery(query);

  if (steps.length === 0) {
    return { sourceTableId: null, hops: [], supplementalTable: null };
  }

  // Root step determines the source table.
  const rootMatch = findTableByDatasetId(steps[0].dataset_id, tablesByDim);
  const sourceTableId = rootMatch?.table.id ?? null;

  const hops: ChainHop[] = [];

  // Walk intermediate steps (everything except the leaf) to find door hops.
  for (let i = 0; i < steps.length - 1; i++) {
    const step = steps[i];

    // Find the table this step belongs to.
    const match = findTableByDatasetId(step.dataset_id, tablesByDim);
    if (!match) continue;

    const { table } = match;
    const col = step.identifier;
    const colMeta = table.columns[col];

    if (!colMeta?.references) continue;

    const targetDim = colMeta.references;

    // Count how many FK columns in the same table point to the same target.
    let fkCountToSameTarget = 0;
    for (const [, meta] of Object.entries(table.columns)) {
      if (meta.references === targetDim) {
        fkCountToSameTarget++;
      }
    }

    if (fkCountToSameTarget >= 2) {
      // Many-to-one: this was a door hop.
      hops.push({ throughCol: col, toDim: targetDim });
    }
    // Otherwise one-to-one: auto-traversed, not a user-visible hop.
  }

  // Leaf step: check if it's from a supplemental table.
  const leafStep = steps[steps.length - 1];
  const leafMatch = findTableByDatasetId(leafStep.dataset_id, tablesByDim);
  let supplementalTable: DerivedNavState["supplementalTable"] = null;

  if (leafMatch) {
    const { table: leafTable, dimType: leafDimType } = leafMatch;
    const primaryId = dimTypeMap[leafDimType]?.metadata_dataset_id;

    if (primaryId && leafTable.id !== primaryId) {
      supplementalTable = {
        tableId: leafTable.id,
        tableName: leafTable.name,
        dimType: leafDimType,
        dimDisplayName: dimTypeMap[leafDimType]?.display_name ?? leafDimType,
      };
    }
  }

  return { sourceTableId, hops, supplementalTable };
}

/**
 * Resolves a display label for a SliceQuery, suitable for use anywhere in the
 * UI (not just inside the chain selector).
 *
 * With schema data, it reconstructs the navigation state and produces the
 * full collapsed label (door hops + supplemental table + leaf column).
 * Without schema data (or if resolution fails), it falls back to a simpler
 * "first › last" label derived from the SliceQuery structure alone.
 */
export function resolveDisplayLabel(
  query: SliceQuery,
  index_type?: string,
  tablesByDim?: Record<string, TableDescriptor[]>,
  dimTypeMap?: Record<string, DimensionTypeDescriptor>
): string {
  if (index_type && tablesByDim && dimTypeMap) {
    try {
      const nav = deriveNavStateFromValue(
        query,
        index_type,
        tablesByDim,
        dimTypeMap
      );

      return displayLabelFromNavState(
        query.identifier,
        nav.hops,
        nav.supplementalTable?.tableName ?? null
      );
    } catch {
      // Fall through to simple label.
    }
  }

  return displayLabelFromSliceQuery(query);
}
