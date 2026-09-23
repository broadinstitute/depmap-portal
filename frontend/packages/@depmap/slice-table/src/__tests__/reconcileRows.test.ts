import { reconcileRows } from "../components/useData";

type Row = Record<string, string | number | undefined>;

const rows = (...specs: Row[]): Row[] => specs.map((r) => ({ ...r }));

describe("reconcileRows", () => {
  it("reuses the previous array when the row set is unchanged", () => {
    const prev = rows({ id: "a", label: "A" }, { id: "b", label: "B" });
    const next = rows({ id: "a", label: "A" }, { id: "b", label: "B" });

    // Identity is the whole point: TanStack memoizes its row model on it, so
    // returning `prev` is what keeps it from rebuilding every Row object.
    expect(reconcileRows(prev, next)).toBe(prev);
  });

  it("folds an added column's values into the existing rows", () => {
    const prev = rows({ id: "a", label: "A" }, { id: "b", label: "B" });
    const next = rows(
      { id: "a", label: "A", score: 1 },
      { id: "b", label: "B", score: 2 }
    );

    const result = reconcileRows(prev, next);

    expect(result).toBe(prev);
    expect(result[0]).toEqual({ id: "a", label: "A", score: 1 });
    expect(result[1]).toEqual({ id: "b", label: "B", score: 2 });
  });

  it("deletes keys for a removed column rather than leaving them stale", () => {
    // `hideIncompleteRows` walks Object.entries(row), so a leftover key from a
    // column that is no longer displayed would silently filter rows out.
    const prev = rows({ id: "a", label: "A", score: 1 });
    const next = rows({ id: "a", label: "A" });

    const result = reconcileRows(prev, next);

    expect(result).toBe(prev);
    expect("score" in result[0]).toBe(false);
  });

  it("rewrites values that changed, not just added columns", () => {
    const prev = rows({ id: "a", label: "A", score: 1 });
    const next = rows({ id: "a", label: "A", score: 99 });

    expect(reconcileRows(prev, next)[0].score).toBe(99);
  });

  it("preserves undefined cells as present-but-undefined keys", () => {
    // transformToTableData assigns `undefined` rather than skipping the key,
    // and react-table's `sortUndefined` behavior depends on that.
    const prev = rows({ id: "a", label: "A" });
    const next = rows({ id: "a", label: "A", score: undefined });

    const result = reconcileRows(prev, next);

    expect("score" in result[0]).toBe(true);
    expect(result[0].score).toBeUndefined();
  });

  it("falls back to the new array when a row is added", () => {
    const prev = rows({ id: "a" });
    const next = rows({ id: "a" }, { id: "b" });

    expect(reconcileRows(prev, next)).toBe(next);
  });

  it("falls back to the new array when a row is removed", () => {
    const prev = rows({ id: "a" }, { id: "b" });
    const next = rows({ id: "a" });

    expect(reconcileRows(prev, next)).toBe(next);
  });

  it("falls back to the new array when rows are reordered", () => {
    const prev = rows({ id: "a" }, { id: "b" });
    const next = rows({ id: "b" }, { id: "a" });

    expect(reconcileRows(prev, next)).toBe(next);
  });

  it("falls back to the new array on the first call", () => {
    const next = rows({ id: "a" });

    expect(reconcileRows(null, next)).toBe(next);
  });

  it("falls back to the new array when either side is empty", () => {
    const next = rows({ id: "a" });

    expect(reconcileRows([], next)).toBe(next);
    expect(reconcileRows(rows({ id: "a" }), [])).toEqual([]);
  });
});
