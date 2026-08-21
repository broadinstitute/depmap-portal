import type {
  ColumnDef as TanStackColumnDef,
  RowData,
} from "@tanstack/react-table";

// TanStack's ColumnDef, plus how this table decides a column's width.
//
// Width is either stated or shared out. A column with a `size` and no
// `autoSize` keeps that width; a column without a `size` is given an equal
// share of whatever the stated columns leave over, and re-shares it when the
// container resizes.
//
// `autoSize` says so explicitly, which matters because the alternative was
// inferring it: a default size was filled in first and the decision then read
// that exact value back as "unset". Anyone who genuinely wanted that width got
// auto-sizing instead, silently, and a column that auto-sizes when its author
// thought it wouldn't is hard to attribute to a number in a column definition.
//
// Set it alongside a `size` to auto-size from a starting width.
export type ColumnDef<
  TData extends RowData,
  TValue = unknown
> = TanStackColumnDef<TData, TValue> & {
  autoSize?: boolean;
};
