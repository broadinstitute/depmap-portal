export interface ReferenceEdge {
  column: string;
  target_type: string;
  cardinality: "scalar" | "list";
}

export interface ReferenceGraphTable {
  id: string;
  given_id: string | null;
  slice_dataset_id: string;
  name: string;
  data_type: string;
  is_primary: boolean;
  references: ReferenceEdge[];
}

export interface ReferenceGraphNode {
  name: string;
  display_name: string;
  axis: "feature" | "sample";
  metadata_dataset_id: string | null;
  tables: ReferenceGraphTable[];
}

export interface DimensionTypeReferenceGraph {
  dimension_types: ReferenceGraphNode[];
}

export interface SliceQueryChainNode {
  dataset_id: string;
  identifier: string;
  identifier_type: "column";
  reindex_through?: SliceQueryChainNode | null;
}

export interface ReachableTable {
  id: string;
  given_id: string | null;
  slice_dataset_id: string;
  name: string;
  is_primary: boolean;
  offered_by_picker: boolean;
  columns: { name: string; col_type: string }[];
  slice_query_template: {
    dataset_id: string;
    identifier_type: "column";
    reindex_through?: SliceQueryChainNode | null;
  };
}

export interface ReachableRoute {
  start_table: string;
  hops: {
    source_dataset_id: string;
    column: string;
    target_type: string;
    cardinality: "scalar" | "list";
  }[];
  result_is_list: boolean;
  tables: ReachableTable[];
}

export interface ReachableTables {
  index_type: string;
  max_depth: number;
  routes: ReachableRoute[];
}
