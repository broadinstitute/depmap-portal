import { CategoryRow } from "./bestCategories";

// The category picker's download, as data rather than as a file.
//
// Kept separate from the picker for two reasons: `downloadCsv` wants
// column-oriented data, which is a transpose worth testing on its own, and the
// picker's table is virtualized, so nothing about it can be asserted in jsdom.

export const CATEGORY_CSV_ID_COLUMN = "Category";

export default function buildCategoryCsvColumns({
  rows,
  axisLabels,
  displayOrder = undefined,
  selected,
}: {
  rows: CategoryRow[];
  // Parallel to the mean columns, and named the same way the table names them.
  axisLabels: string[];
  // The rows the table is currently showing, in the order it is showing them.
  // Omitted when the table hasn't reported any, in which case `rows` order
  // stands.
  displayOrder?: string[];
  selected: Set<string>;
}): Record<string, (string | number | undefined)[]> {
  const ordered = displayOrder
    ? (displayOrder
        .map((category) => rows.find((row) => row.category === category))
        .filter(Boolean) as CategoryRow[])
    : rows;

  // Insertion order is the column order: downloadCsv moves the id column to
  // the front and otherwise leaves this sequence alone.
  const columns: Record<string, (string | number | undefined)[]> = {
    [CATEGORY_CSV_ID_COLUMN]: ordered.map((row) => row.category),
    // Which categories the plot is drawing separately is the one thing this
    // table decides, so it travels with the statistics that justified it.
    Selected: ordered.map((row) => (selected.has(row.category) ? "Yes" : "No")),
    Points: ordered.map((row) => row.count),
    Score: ordered.map((row) => row.score),
  };

  // Raw values, not the table's formatted ones: a CSV is read by something that
  // wants to compute, and the display formatter rounds to three decimals and
  // renders the empty and infinite cases as glyphs.
  if (axisLabels[0]) {
    columns[`Mean ${axisLabels[0]}`] = ordered.map((row) => row.meanX);
  }

  if (axisLabels[1]) {
    columns[`Mean ${axisLabels[1]}`] = ordered.map((row) => row.meanY);
  }

  return columns;
}
