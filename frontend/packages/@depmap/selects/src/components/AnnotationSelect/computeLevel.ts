/* eslint-disable no-continue */
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

/**
 * Walks FK references from a dimension type's primary metadata table,
 * auto-traversing one-to-one relationships and surfacing many-to-one
 * relationships as "doors" the user clicks through.
 *
 * @param dimType        The dimension type name to start from.
 * @param tablesByDim    All tabular datasets grouped by index_type_name.
 * @param dimTypeMap     Dimension type name → descriptor (for display names,
 *                       metadata_dataset_id, etc.).
 * @param visited        Set of dim type names already traversed (cycle guard).
 * @param startTable     Optional override table. When provided, use this
 *                       instead of finding the primary metadata table.
 *                       Used when a non-primary source table is selected.
 */
export default function computeLevel(
  dimType: string,
  tablesByDim: Record<string, TableDescriptor[]>,
  dimTypeMap: Record<string, DimensionTypeDescriptor>,
  visited: Set<string>,
  startTable?: TableDescriptor
): LevelResult {
  visited.add(dimType);

  const dimInfo = dimTypeMap[dimType];
  const dimDisplayName = dimInfo?.display_name ?? dimType;
  const tables = tablesByDim[dimType] ?? [];

  // Find the active table: explicit startTable or primary metadata.
  const metadataDatasetId = dimInfo?.metadata_dataset_id ?? null;
  const activeTable =
    startTable ?? tables.find((t) => t.id === metadataDatasetId) ?? null;

  // Supplemental tables at this dim type (everything except the active table).
  const supplementalTables: SupplementalTable[] = tables
    .filter((t) => t.id !== (activeTable?.id ?? metadataDatasetId))
    .map((t) => {
      const colCount = Object.keys(t.columns).filter((name) => name !== "label")
        .length;

      return {
        dimType,
        dimDisplayName,
        table: t,
        columnCount: colCount,
      };
    });

  if (!activeTable) {
    return { doors: [], supplementalTables, columns: [] };
  }

  // Collect columns and FK references from the active table.
  const columns: ColumnEntry[] = [];
  const doors: Door[] = [];

  // Group FK columns by their target dim type to determine cardinality.
  const fksByTarget: Record<string, string[]> = {};

  for (const [colName, meta] of Object.entries(activeTable.columns)) {
    if (colName === "label") continue;

    if (meta.references && !visited.has(meta.references)) {
      if (!fksByTarget[meta.references]) {
        fksByTarget[meta.references] = [];
      }
      fksByTarget[meta.references].push(colName);
    }
  }

  // Emit leaf columns from the active table.
  for (const colName of Object.keys(activeTable.columns)) {
    if (colName === "label") continue;

    columns.push({
      columnName: colName,
      dimType,
      dimDisplayName,
      tableName: activeTable.name,
      tableId: activeTable.id,
      tableGivenId: activeTable.given_id,
      autoPath: [],
    });
  }

  // Process FK groups. Use a shared visited set so parallel auto-traversals
  // don't independently reach the same dim type (the first path wins).
  for (const [targetDim, fkCols] of Object.entries(fksByTarget)) {
    const targetDisplayName = dimTypeMap[targetDim]?.display_name ?? targetDim;

    if (fkCols.length >= 2) {
      // Many-to-one: emit as doors (user chooses which FK to traverse).
      for (const colName of fkCols) {
        doors.push({
          columnName: colName,
          targetDim,
          targetDimDisplayName: targetDisplayName,
        });
      }
    } else if (!visited.has(targetDim)) {
      // One-to-one: auto-traverse silently. The visited check here guards
      // against a dim type already claimed by an earlier sibling traversal.
      const throughCol = fkCols[0];
      const deeper = computeLevel(targetDim, tablesByDim, dimTypeMap, visited);

      // Prepend this hop to each deeper column's autoPath.
      for (const col of deeper.columns) {
        columns.push({
          ...col,
          autoPath: [{ throughCol, toDim: targetDim }, ...col.autoPath],
        });
      }

      // Merge deeper doors (these become doors at the current level too,
      // since the user can't interact with auto-traversed hops).
      doors.push(...deeper.doors);

      // Merge deeper supplemental tables.
      supplementalTables.push(...deeper.supplementalTables);
    }
  }

  return { doors, supplementalTables, columns };
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
