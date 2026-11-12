import type {
  ColumnEntry,
  ColumnGroup,
  DimensionTypeDescriptor,
  Door,
  SupplementalTable,
  TableDescriptor,
} from "./types";

/**
 * The result of computing one level of FK-chain navigation.
 */
export interface LevelResult {
  /** Many-to-one FK choices the user must pick between. */
  doors: Door[];
  /** Non-primary tables at reachable dim types. */
  supplementalTables: SupplementalTable[];
  /** Flattened columns from auto-traversed primary tables. */
  columns: ColumnEntry[];
}

interface FkGroup {
  targetDim: string;
  cols: string[];
}

interface Claim {
  parentDim: string;
  throughCol: string;
  /** FK columns from the root to this dim, for tie-breaking. */
  path: string[];
}

/**
 * Plans which dim types get auto-traversed, and by which FK column.
 *
 * A single FK is dropped as a redundant shortcut when its target is also
 * reachable through another FK in the same table (e.g. `screen.ModelID` when
 * `screen.ModelConditionID` leads to a table that references the same
 * model). Links minted through a shortcut would break if the denormalized
 * column were ever removed, so the longer route is the canonical one. If two
 * FKs reach each other, neither is treated as a shortcut.
 *
 * Routes that remain are resolved breadth-first (shortest first). Ties between
 * routes of equal length are broken alphabetically by the FK column names
 * along the route, first hop first (then by parent dim name), so the result
 * never depends on column declaration order.
 *
 * At each dim, FKs to targets that are already claimed (at this depth or a
 * shallower one) or in `visited` are ignored before counting, so a target
 * with 2+ remaining FKs is a door and one with exactly 1 is a candidate for
 * auto-traversal.
 */
function planTraversal(
  startDim: string,
  startTable: TableDescriptor,
  tablesByDim: Record<string, TableDescriptor[]>,
  dimTypeMap: Record<string, DimensionTypeDescriptor>,
  visited: Set<string>
) {
  const claims = new Map<string, Claim>();
  const fkGroupsByDim = new Map<string, FkGroup[]>();
  const excluded = new Set(visited);
  let level = [startDim];

  const tableFor = (dim: string) => {
    if (dim === startDim) return startTable;
    const primaryId = dimTypeMap[dim]?.metadata_dataset_id ?? null;
    return (tablesByDim[dim] ?? []).find((t) => t.id === primaryId) ?? null;
  };

  // Every dim reachable by following forward FKs from `from`, ignoring dims
  // that are already excluded.
  const reachableFrom = (from: string) => {
    const seen = new Set<string>();
    const stack = [from];

    while (stack.length > 0) {
      const cur = stack.pop() as string;

      for (const meta of Object.values(tableFor(cur)?.columns ?? {})) {
        const target = meta.references;

        if (target && !excluded.has(target) && !seen.has(target)) {
          seen.add(target);
          stack.push(target);
        }
      }
    }

    return seen;
  };

  while (level.length > 0) {
    const candidates = new Map<string, Claim[]>();

    for (const dim of level) {
      const table = tableFor(dim);
      const groups: FkGroup[] = [];
      const byTarget: Record<string, FkGroup> = {};

      for (const [colName, meta] of Object.entries(table?.columns ?? {})) {
        const target = meta.references;

        if (target && !excluded.has(target)) {
          if (!byTarget[target]) {
            byTarget[target] = { targetDim: target, cols: [] };
            groups.push(byTarget[target]);
          }
          byTarget[target].cols.push(colName);
        }
      }

      fkGroupsByDim.set(dim, groups);

      const singles = groups.filter((g) => g.cols.length === 1);
      const reach = new Map(
        singles.map((g) => [g.targetDim, reachableFrom(g.targetDim)])
      );
      const isShortcut = (g: FkGroup) =>
        singles.some(
          (h) =>
            h !== g &&
            reach.get(h.targetDim)?.has(g.targetDim) &&
            !reach.get(g.targetDim)?.has(h.targetDim)
        );

      for (const g of singles) {
        if (!isShortcut(g)) {
          const list = candidates.get(g.targetDim) ?? [];
          list.push({
            parentDim: dim,
            throughCol: g.cols[0],
            path: [...(claims.get(dim)?.path ?? []), g.cols[0]],
          });
          candidates.set(g.targetDim, list);
        }
      }
    }

    const next: string[] = [];

    for (const [target, list] of candidates) {
      const winner = [...list].sort(
        (a, b) =>
          a.path.join("\u0000").localeCompare(b.path.join("\u0000")) ||
          a.parentDim.localeCompare(b.parentDim)
      )[0];
      claims.set(target, winner);
      next.push(target);
    }

    // Claim after the whole level is processed so that sibling order cannot
    // influence door counting at this depth.
    next.sort();
    next.forEach((d) => excluded.add(d));
    level = next;
  }

  return { claims, fkGroupsByDim };
}

/**
 * Walks FK references from a dimension type's primary metadata table,
 * auto-traversing one-to-one relationships and surfacing many-to-one
 * relationships as "doors" the user clicks through.
 *
 * When several routes reach the same dim type, redundant shortcut FKs are
 * dropped first, then the shortest route wins and ties go to the
 * alphabetically first FK column (see `planTraversal`). Losing routes are not
 * offered.
 *
 * @param dimType        The dimension type name to start from.
 * @param index_type     The picker's root dimension type. Used to suppress
 *                       same-dim supplementals at this exact dim, since
 *                       those tables are already offered in the source
 *                       picker (Widget 1) and showing them again under
 *                       "Continue to table" would be redundant.
 * @param tablesByDim    All tabular datasets grouped by index_type_name.
 * @param dimTypeMap     Dimension type name → descriptor (for display names,
 *                       metadata_dataset_id, etc.).
 * @param visited        Set of dim type names already traversed (cycle guard).
 *                       Every dim reached is added to it.
 * @param startTable     Optional override table. When provided, use this
 *                       instead of finding the primary metadata table.
 *                       Used when a non-primary source table is selected.
 */
export default function computeLevel(
  dimType: string,
  index_type: string,
  tablesByDim: Record<string, TableDescriptor[]>,
  dimTypeMap: Record<string, DimensionTypeDescriptor>,
  visited: Set<string>,
  startTable?: TableDescriptor
): LevelResult {
  visited.add(dimType);

  const rootMetadataId = dimTypeMap[dimType]?.metadata_dataset_id ?? null;
  const rootTable =
    startTable ??
    (tablesByDim[dimType] ?? []).find((t) => t.id === rootMetadataId) ??
    null;

  const plan = rootTable
    ? planTraversal(dimType, rootTable, tablesByDim, dimTypeMap, visited)
    : null;

  const walk = (dim: string, override?: TableDescriptor): LevelResult => {
    const dimInfo = dimTypeMap[dim];
    const dimDisplayName = dimInfo?.display_name ?? dim;
    const tables = tablesByDim[dim] ?? [];

    const metadataDatasetId = dimInfo?.metadata_dataset_id ?? null;
    const activeTable =
      override ?? tables.find((t) => t.id === metadataDatasetId) ?? null;

    // Supplemental tables at this dim type (everything except the active
    // table). Skipped entirely when this dim is the picker's index_type,
    // since those tables are already offered in the source picker.
    const supplementalTables: SupplementalTable[] =
      dim === index_type
        ? []
        : tables
            .filter((t) => t.id !== (activeTable?.id ?? metadataDatasetId))
            .map((t) => ({
              dimType: dim,
              dimDisplayName,
              table: t,
              columnCount: Object.keys(t.columns).length,
              autoPath: [],
            }));

    if (!activeTable || !plan) {
      return { doors: [], supplementalTables, columns: [] };
    }

    const columns: ColumnEntry[] = Object.keys(activeTable.columns).map(
      (colName) => ({
        columnName: colName,
        dimType: dim,
        dimDisplayName,
        tableName: activeTable.name,
        tableId: activeTable.id,
        tableGivenId: activeTable.given_id,
        autoPath: [],
      })
    );
    const doors: Door[] = [];

    for (const { targetDim, cols } of plan.fkGroupsByDim.get(dim) ?? []) {
      if (cols.length >= 2) {
        // Many-to-one: emit as doors (user chooses which FK to traverse).
        const targetDisplayName =
          dimTypeMap[targetDim]?.display_name ?? targetDim;

        for (const colName of cols) {
          doors.push({
            columnName: colName,
            targetDim,
            targetDimDisplayName: targetDisplayName,
          });
        }
      } else {
        const claim = plan.claims.get(targetDim);
        const throughCol = cols[0];

        // Only the winning route traverses; losing routes are dropped.
        if (claim?.parentDim === dim && claim.throughCol === throughCol) {
          const deeper = walk(targetDim);
          const hop = { throughCol, toDim: targetDim };

          for (const col of deeper.columns) {
            columns.push({ ...col, autoPath: [hop, ...col.autoPath] });
          }

          // Deeper doors become doors at this level too, since the user
          // can't interact with auto-traversed hops.
          doors.push(...deeper.doors);

          for (const st of deeper.supplementalTables) {
            supplementalTables.push({ ...st, autoPath: [hop, ...st.autoPath] });
          }
        }
      }
    }

    return { doors, supplementalTables, columns };
  };

  const result = walk(dimType, startTable);
  plan?.claims.forEach((_, dim) => visited.add(dim));

  return result;
}

/**
 * Groups a flat list of ColumnEntry objects by (dimType, tableId) and sorts
 * groups broadest-to-narrowest by minimum hop distance.
 */
export function groupColumns(columns: ColumnEntry[]): ColumnGroup[] {
  const groupMap = new Map<string, ColumnGroup>();

  for (const col of columns) {
    const key = `${col.dimType}::${col.tableId}`;
    let group = groupMap.get(key);

    if (!group) {
      group = {
        dimType: col.dimType,
        dimDisplayName: col.dimDisplayName,
        tableName: col.tableName,
        tableId: col.tableId,
        minHops: col.autoPath.length,
        columns: [],
      };
      groupMap.set(key, group);
    }

    group.minHops = Math.min(group.minHops, col.autoPath.length);
    group.columns.push(col);
  }

  const groups = Array.from(groupMap.values());

  // Sort broadest-to-narrowest: fewer hops first, then alpha by dim name.
  groups.sort((a, b) => {
    if (a.minHops !== b.minHops) return a.minHops - b.minHops;
    return a.dimDisplayName.localeCompare(b.dimDisplayName);
  });

  return groups;
}
