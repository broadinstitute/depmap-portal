export { default } from "./src/components/ReactTable";

// The UI for `enableSearch`. Kept out of ReactTable itself (the table has no
// control bar to put it in) but shipped with it, since everything the input
// does is behind the table's own ref handle.
export { default as SearchBar } from "./src/components/SearchBar";
export type { SearchBarProps } from "./src/components/SearchBar";

export type { ReactTableHandle } from "./src/components/ReactTable";

export type { ColumnDef } from "./src/types";

// Re-export specific types from @tanstack/react-table
export type {
  RowSelectionState,
  RowData,
  SortingState,
  Row,
  Column,
  Table,
} from "@tanstack/react-table";
