import rowSelectionChanged from "../rowSelectionChanged";

describe("rowSelectionChanged", () => {
  it("sees an addition and a removal", () => {
    expect(rowSelectionChanged({ a: true }, { a: true, b: true })).toBe(true);
    expect(rowSelectionChanged({ a: true, b: true }, { a: true })).toBe(true);
  });

  it("sees no change when the same rows are selected", () => {
    expect(
      rowSelectionChanged({ a: true, b: true }, { b: true, a: true })
    ).toBe(false);
    expect(rowSelectionChanged({}, {})).toBe(false);
  });

  it("treats an explicit false the same as an absent key", () => {
    // TanStack expresses a deselected row both ways depending on how it got
    // there. Comparing keys instead of selected ids reports a change between
    // these two, which is the same selection written differently.
    expect(rowSelectionChanged({ a: true, b: false }, { a: true })).toBe(false);
    expect(rowSelectionChanged({ a: true }, { a: true, b: false })).toBe(false);
  });

  it("sees a row being turned off in place", () => {
    // The other half of the above: same keys, different selection. A key-based
    // comparison misses this entirely.
    expect(
      rowSelectionChanged({ a: true, b: true }, { a: true, b: false })
    ).toBe(true);
  });

  it("reports a return to an earlier selection", () => {
    // The bug this function exists for. A consumer that compares against the
    // *initial* selection rather than the last reported one swallows this,
    // leaving its own count stuck at the value from before the undo -- and only
    // for rows that were in the initial set, which makes it look like specific
    // rows are broken.
    const seed = { a: true, b: true };
    const added = { a: true, b: true, c: true };

    expect(rowSelectionChanged(seed, added)).toBe(true);
    expect(rowSelectionChanged(added, seed)).toBe(true);
  });
});
