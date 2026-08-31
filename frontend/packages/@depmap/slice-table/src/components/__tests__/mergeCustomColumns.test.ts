import { mergeCustomColumns } from "../useSliceTableState";

// The real array is [id, label, ...userSlices], with the checkbox column
// prepended later inside @depmap/react-table.
const LEADING = 2;
const sliceColumns = ["id", "label", "sliceA", "sliceB"];
const customColumns = ["variance", "count"];

describe("mergeCustomColumns", () => {
  it("appends by default, exactly as it always did", () => {
    expect(
      mergeCustomColumns(sliceColumns, customColumns, LEADING, "end")
    ).toEqual(["id", "label", "sliceA", "sliceB", "variance", "count"]);
  });

  it("puts custom columns before the slices when asked", () => {
    expect(
      mergeCustomColumns(
        sliceColumns,
        customColumns,
        LEADING,
        "beforeSliceColumns"
      )
    ).toEqual(["id", "label", "variance", "count", "sliceA", "sliceB"]);
  });

  it("never displaces the leading columns", () => {
    // The hazard this function exists to avoid. react-table makes the first
    // data column sticky and excludes it from width redistribution, so a custom
    // column at index 0 would be frozen and mis-sized.
    const merged = mergeCustomColumns(
      sliceColumns,
      customColumns,
      LEADING,
      "beforeSliceColumns"
    );

    expect(merged.slice(0, LEADING)).toEqual(["id", "label"]);
  });

  it("holds up when there are no slices to sit before", () => {
    // A table showing only id/label until the user adds a column.
    expect(
      mergeCustomColumns(
        ["id", "label"],
        customColumns,
        LEADING,
        "beforeSliceColumns"
      )
    ).toEqual(["id", "label", "variance", "count"]);
  });

  it("is a no-op with no custom columns", () => {
    expect(mergeCustomColumns(sliceColumns, [], LEADING, "end")).toEqual(
      sliceColumns
    );
    expect(
      mergeCustomColumns(sliceColumns, [], LEADING, "beforeSliceColumns")
    ).toEqual(sliceColumns);
  });
});
