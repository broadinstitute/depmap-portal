import type { ColumnMetadata, TabularDataset } from "@depmap/types";

/**
 * Minimal descriptor for a dimension type, derived from the
 * /dimension_types API response.
 */
export interface DimensionTypeDescriptor {
  name: string;
  display_name: string;
  id_column: string;
  axis: string;
  metadata_dataset_id: string | null;
}

/**
 * A single tabular dataset with its columns, used as the navigable schema
 * for the chain selector.
 */
export interface TableDescriptor {
  id: string;
  given_id: string | null;
  name: string;
  columns: Record<string, ColumnMetadata>;
}

/**
 * All tabular datasets grouped by dimension type name.
 */
export type TablesByDim = Record<string, TableDescriptor[]>;

/**
 * A single hop in a FK chain: "through column X, into dimension type Y".
 */
export interface ChainHop {
  throughCol: string;
  toDim: string;
}

/**
 * A door the user can click to navigate through a many-to-one FK.
 */
export interface Door {
  columnName: string;
  targetDim: string;
  targetDimDisplayName: string;
}

/**
 * A supplemental (non-primary) table reachable at some dimension type.
 */
export interface SupplementalTable {
  dimType: string;
  dimDisplayName: string;
  table: TableDescriptor;
  columnCount: number;
}

/**
 * A column entry in the flattened properties list, with the auto-path
 * of one-to-one hops that were traversed to reach it.
 */
export interface ColumnEntry {
  columnName: string;
  dimType: string;
  dimDisplayName: string;
  tableName: string;
  tableId: string;
  tableGivenId: string | null;
  autoPath: ChainHop[];
}

/**
 * Grouping key for columns in the properties section.
 */
export interface ColumnGroup {
  dimType: string;
  dimDisplayName: string;
  tableName: string;
  tableId: string;
  minHops: number;
  columns: ColumnEntry[];
}

/**
 * Additional metadata about a selected slice from a matrix dataset.
 */
export interface MatrixSliceMetadata {
  label: string;
  slice_type: string | null;
}
