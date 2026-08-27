import getCategoricalPreviewMode, {
  MAX_PLOTTABLE_CATEGORIES,
  NEAR_UNIQUE_MIN_DISTINCT,
} from "../getCategoricalPreviewMode";

describe("getCategoricalPreviewMode", () => {
  it("plots an ordinary categorical column", () => {
    // e.g. lineage across 2000 models
    expect(getCategoricalPreviewMode(30, 2000)).toBe("plot");
  });

  it("plots a small column even when every value is unique", () => {
    expect(getCategoricalPreviewMode(10, 10)).toBe("plot");
  });

  it("omits a column that is a 1-to-1 mapping of the ID column", () => {
    expect(getCategoricalPreviewMode(2000, 2000)).toBe("omit");
  });

  it("omits a column that is close to 1-to-1", () => {
    // 95% of values are distinct
    expect(getCategoricalPreviewMode(1900, 2000)).toBe("omit");
  });

  it("does not omit near-unique below the distinct-value floor", () => {
    expect(getCategoricalPreviewMode(NEAR_UNIQUE_MIN_DISTINCT - 1, 49)).toBe(
      "plot"
    );
  });

  it("truncates when counts vary but there are too many categories", () => {
    // The reported case: DepmapGeneName over transcripts. Far from 1-to-1, so
    // the most common values are worth seeing — just not all 29,496 of them.
    expect(getCategoricalPreviewMode(29496, 336580)).toBe("truncate");
  });

  it("truncates a column the plot could render but nobody could read", () => {
    // ~3,700 categories still plots, but only 20 fit in the window and the
    // tick labels past ~39 get dropped arbitrarily.
    expect(getCategoricalPreviewMode(3657, 100000)).toBe("truncate");
  });

  it("plots right up to the category limit", () => {
    expect(
      getCategoricalPreviewMode(
        MAX_PLOTTABLE_CATEGORIES,
        MAX_PLOTTABLE_CATEGORIES * 10
      )
    ).toBe("plot");
  });

  it("prefers omitting over truncating when a huge column is also near-unique", () => {
    expect(getCategoricalPreviewMode(100000, 100000)).toBe("omit");
  });

  it("handles an empty column", () => {
    expect(getCategoricalPreviewMode(0, 0)).toBe("plot");
  });
});
