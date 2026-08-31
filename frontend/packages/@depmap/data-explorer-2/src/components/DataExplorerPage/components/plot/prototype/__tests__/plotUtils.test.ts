import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  calcBins,
  calcDensityStats,
  calcVisibility,
  collapseCategoricalSeries,
  categoryToDisplayName,
  computeContinuousLegendKeySeries,
  computeCustomFilterSeries,
  computeFacetedLinReg,
  computeFacets,
  countPlottablePoints,
  DEFAULT_PALETTE,
  findCategoricalSlice,
  findContinuousColorSlice,
  formatDataForWaterfall,
  getColorMap,
  getLegendKeysWithNoData,
  LEGEND_ALL,
  LEGEND_BOTH,
  LEGEND_NEITHER,
  LEGEND_OTHER,
  LEGEND_REMAINDER,
  LegendKey,
  makeLegendKeyResolver,
  orderColorKeysByCount,
  REMAINDER_FACET,
  NEUTRAL_FACET_FILL,
  REMAINDER_FILL,
  reorderColorMap,
  resolveColorMode,
  hasRealFacetPartition,
  truncateFacetLabel,
  facetLabelBudget,
} from "../plotUtils";

// Minimal response fixture with independent color and facet backings, used to
// pin the color_by/facet_by extraction: the two triads (dimensions.color +
// metadata.color_property vs dimensions.facet + metadata.facet_property) must
// never be conflated, and an unset facet_by must mean "no faceting" rather
// than falling back to color_by.
const baseData = ({
  index_type: "depmap_model",
  index_ids: ["a", "b", "c"],
  index_labels: ["A", "B", "C"],
  dimensions: {
    x: {
      axis_label: "x",
      dataset_id: "x-dataset",
      dataset_label: "X",
      slice_type: "depmap_model",
      values: [1, 2, 3],
      value_type: "continuous",
      units: "unitless",
    },
  },
  filters: {},
  metadata: {
    color_property: {
      label: "Lineage",
      sliceQuery: { dataset_id: "lineage-dataset" },
      values: ["lung", "breast", "lung"],
      value_type: "categorical",
    },
    facet_property: {
      label: "Sex",
      sliceQuery: { dataset_id: "sex-dataset" },
      values: ["male", "female", "female"],
      value_type: "categorical",
    },
  },
} as unknown) as DataExplorerPlotResponse;

describe("truncateFacetLabel", () => {
  it("leaves a label that fits alone", () => {
    expect(truncateFacetLabel("Skin")).toBe("Skin");
  });

  it("trims a long one and says it did", () => {
    // A transcript id alone already exceeds the limit, which is why both
    // faceted renderers need this rather than only the one with an axis
    // gutter.
    const long = "ENST00000263100.8 (protein coding, canonical)";
    const result = truncateFacetLabel(long);

    expect(result).toHaveLength(26); // 25 characters plus the ellipsis
    expect(result.endsWith("\u2026")).toBe(true);
    expect(long.startsWith(result.slice(0, -1))).toBe(true);
  });

  it("does not trim a label exactly at the limit", () => {
    const exact = "a".repeat(25);

    expect(truncateFacetLabel(exact)).toBe(exact);
    expect(truncateFacetLabel(`${exact}b`)).toBe(`${exact}\u2026`);
  });

  it("passes an empty label through", () => {
    expect(truncateFacetLabel("")).toBe("");
  });

  it("honors a caller-supplied budget", () => {
    expect(truncateFacetLabel("Peripheral Nervous System", 10)).toBe(
      "Peripheral…"
    );
  });
});

describe("facetLabelBudget", () => {
  // The small-multiples grid, which is what makes this computable at all.
  const colsFor = (facetCount: number) =>
    Math.max(1, Math.ceil(Math.sqrt(facetCount)));

  // A typical Data Explorer plot column, minus the figure's l/r margins.
  const GRID_WIDTH = 816;
  const FONT_SIZE = 11;

  const budgetFor = (facetCount: number, gridWidth = GRID_WIDTH) =>
    facetLabelBudget({
      gridWidth,
      cols: colsFor(facetCount),
      fontSize: FONT_SIZE,
    });

  it("never exceeds the shared default", () => {
    // One panel spanning the whole figure has room for far more than 25
    // characters. It still doesn't get them: a facet should read the same
    // however it is drawn.
    expect(budgetFor(1)).toBe(25);
    expect(budgetFor(4)).toBe(25);
  });

  it("tightens as the grid gains columns", () => {
    // Successive perfect squares, so each step is a real extra column rather
    // than a partly-filled row.
    const budgets = [1, 4, 9, 16, 25, 36, 49].map((f) => budgetFor(f));

    for (let i = 1; i < budgets.length; i += 1) {
      expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1]);
    }

    // And it actually moves — a monotone constant would pass the above.
    expect(budgets[budgets.length - 1]).toBeLessThan(budgets[0]);
  });

  it("tightens as the figure narrows at a fixed facet count", () => {
    expect(budgetFor(16, 500)).toBeLessThan(budgetFor(16, GRID_WIDTH));
  });

  it("keeps enough characters to tell facets apart", () => {
    // Well past HARD_MAX_CATEGORIES in a cramped column: still legible.
    expect(budgetFor(200, 300)).toBeGreaterThanOrEqual(8);
  });

  it("does not tighten when the figure has not been measured", () => {
    // Deriving a budget from a zero width would floor every label on the
    // first pass, before the node has a size.
    expect(facetLabelBudget({ gridWidth: 0, cols: 6, fontSize: 11 })).toBe(25);
    expect(facetLabelBudget({ gridWidth: NaN, cols: 6, fontSize: 11 })).toBe(
      25
    );
  });
});

describe("countPlottablePoints", () => {
  const dim = (values: (number | null)[]) => ({ values } as any);

  it("counts points that would actually be drawn", () => {
    expect(countPlottablePoints({ dimensions: { x: dim([1, null, 3]) } })).toBe(
      2
    );
  });

  it("requires every axis in play, not just one", () => {
    // The sparse case this exists for: measured on x, absent on y, so the
    // scatter has nothing to place. Counting it would report a plot as
    // non-empty while it drew nothing.
    expect(
      countPlottablePoints({
        dimensions: { x: dim([1, 2, 3]), y: dim([1, null, null]) },
      })
    ).toBe(1);
  });

  it("ignores points the user has filtered out", () => {
    expect(
      countPlottablePoints({
        dimensions: { x: dim([1, 2, 3]) },
        filters: { visible: { values: [true, false, false] } },
      })
    ).toBe(1);
  });

  it("reports zero when a dataset covers none of the selection", () => {
    expect(countPlottablePoints({ dimensions: { x: dim([null, null]) } })).toBe(
      0
    );
  });

  it("distinguishes 'nothing to judge by' from 'nothing to draw'", () => {
    // null, not 0 — a correlation heatmap has no per-point axes at all, and a
    // half-configured plot has no x yet. Treating either as empty would put an
    // apology on a plot that is working fine.
    expect(countPlottablePoints({ dimensions: {} })).toBeNull();
    expect(countPlottablePoints(null)).toBeNull();
  });
});

describe("findCategoricalSlice", () => {
  test("target 'color' reads metadata.color_property", () => {
    const slice = findCategoricalSlice(baseData, "property", "color");
    expect(slice?.label).toBe("Lineage");
    expect(slice?.values).toEqual(["lung", "breast", "lung"]);
  });

  test("target 'facet' reads metadata.facet_property, not color_property", () => {
    const slice = findCategoricalSlice(baseData, "property", "facet");
    expect(slice?.label).toBe("Sex");
    expect(slice?.values).toEqual(["male", "female", "female"]);
  });

  test("defaults to target 'color' when omitted", () => {
    const slice = findCategoricalSlice(baseData, "property");
    expect(slice?.label).toBe("Lineage");
  });

  test("mode 'expansion' ignores target and reads data.expansions", () => {
    const expandedData = ({
      ...baseData,
      expansions: [
        {
          ids: ["t1", "t2"],
          labels: ["Transcript 1", "Transcript 2"],
          slice_type: "transcript",
          display_name: "Transcript",
        },
      ],
    } as unknown) as DataExplorerPlotResponse;

    const colorSlice = findCategoricalSlice(expandedData, "expansion", "color");
    const groupSlice = findCategoricalSlice(expandedData, "expansion", "facet");
    expect(colorSlice?.values).toEqual(["Transcript 1", "Transcript 2"]);
    expect(groupSlice?.values).toEqual(["Transcript 1", "Transcript 2"]);
  });
});

describe("findContinuousColorSlice", () => {
  const continuousData = ({
    ...baseData,
    metadata: {
      color_property: {
        label: "Color Continuous",
        values: [1, 2, 3],
        value_type: "continuous",
      },
      facet_property: {
        label: "Facet Continuous",
        values: [4, 5, 6],
        value_type: "continuous",
      },
    },
  } as unknown) as DataExplorerPlotResponse;

  test("target 'facet' reads the facet property, not color", () => {
    const slice = findContinuousColorSlice(continuousData, "facet");
    expect(slice?.label).toBe("Facet Continuous");
    expect(slice?.values).toEqual([4, 5, 6]);
  });
});

// Shared by density (via computeDensitySeriesForMode), waterfall's x-position
// clustering, and scatter's faceting — anywhere a continuous facet_by/color_by
// needs to be binned independent of the categorical/dimension dispatch those
// three renderers otherwise use.
describe("computeContinuousLegendKeySeries", () => {
  test("returns null when there are no bins (e.g. the axis isn't continuous)", () => {
    expect(computeContinuousLegendKeySeries([1, 2, 3], null)).toBeNull();
  });

  test("bins values in natural (ascending) order, filtered to represented bins", () => {
    const bins = calcBins([10, 20, 30]);
    const result = computeContinuousLegendKeySeries([10, 20, 30], bins);

    expect(result).not.toBeNull();
    expect(result!.series.length).toBe(3);
    // Every point landed in some bin (none left unbound).
    result!.series.forEach((key) => expect(typeof key).toBe("symbol"));
    // sortedKeys is non-empty and ordered ascending by bin (Reflect.ownKeys
    // preserves calcBins' own insertion order, which is low-to-high).
    expect(result!.sortedKeys.length).toBeGreaterThan(0);
  });

  test("null values map to LEGEND_OTHER, not left unbound", () => {
    const bins = calcBins([10, 20, 30]);
    const result = computeContinuousLegendKeySeries([10, null, 30], bins);

    expect(result!.series[1]).toBe(LEGEND_OTHER);
  });

  test("drops bins with zero currently-visible points, unless includeEmpty", () => {
    const bins = calcBins([10, 20, 30]);

    const dropped = computeContinuousLegendKeySeries(
      [10, 20, 30],
      bins,
      [true, false, true] // bin for value 20 has no visible point
    );
    const kept = computeContinuousLegendKeySeries(
      [10, 20, 30],
      bins,
      [true, false, true],
      true // includeEmpty
    );

    expect(dropped!.sortedKeys.length).toBeLessThan(kept!.sortedKeys.length);
  });

  // Regression: LEGEND_OTHER is never one of continuousBins' own keys
  // (calcBins only ever produces the 10 real range bins), so sortedKeys
  // used to never include it, no matter how many points were null — which
  // meant getColorMap's sortedLegendKeys-driven reorder (density_1d/
  // waterfall's color legend, and their Facets panel via sortedFacetKeys)
  // silently dropped the null-value ("N/A") legend/facet entry a caller had
  // otherwise correctly added. Points rendered grey with no way to toggle
  // them off. See the matching getColorMap regression test below.
  test("sortedKeys includes LEGEND_OTHER, appended last, when a null value is present", () => {
    const bins = calcBins([10, 20, 30]);
    const result = computeContinuousLegendKeySeries([10, null, 30], bins);

    expect(result!.sortedKeys[result!.sortedKeys.length - 1]).toBe(
      LEGEND_OTHER
    );
  });

  test("sortedKeys excludes LEGEND_OTHER when there's no null value", () => {
    const bins = calcBins([10, 20, 30]);
    const result = computeContinuousLegendKeySeries([10, 20, 30], bins);

    expect(result!.sortedKeys).not.toContain(LEGEND_OTHER);
  });
});

// The same partition color_by's custom-filter mode already used (in filter1
// only / in filter2 only / in BOTH / in NEITHER), extended so facet_by gets
// identical behavior. Shared by computeDensitySeriesForMode (density) and
// computeFacets (waterfall clustering / scatter faceting).
describe("computeCustomFilterSeries", () => {
  const filter1 = { name: "Facet A", values: [true, true, false, false] };
  const filter2 = { name: "Facet B", values: [true, false, true, false] };

  test("partitions into Both/name1/name2/Other", () => {
    const result = computeCustomFilterSeries(filter1, filter2);

    expect(result.series).toEqual([
      LEGEND_BOTH,
      "Facet A",
      "Facet B",
      LEGEND_NEITHER,
    ]);
  });

  test("sortedKeys is the canonical [name1, name2, Both, Other] order, filtered to represented", () => {
    const result = computeCustomFilterSeries(filter1, filter2);

    expect(result.sortedKeys).toEqual([
      "Facet A",
      "Facet B",
      LEGEND_BOTH,
      LEGEND_NEITHER,
    ]);
  });

  test("only one filter selected: Both is never included, even filtered names still appear", () => {
    const result = computeCustomFilterSeries(filter1, undefined);

    expect(result.series).toEqual([
      "Facet A",
      "Facet A",
      LEGEND_NEITHER,
      LEGEND_NEITHER,
    ]);
    expect(result.sortedKeys).toEqual(["Facet A", LEGEND_NEITHER]);
  });

  test("Both/Other are dropped from sortedKeys when no point actually lands there", () => {
    // Every point is in filter1 only — no overlap, no "neither".
    const onlyFilter1 = { name: "Facet A", values: [true, true, true] };
    const emptyFilter2 = { name: "Facet B", values: [false, false, false] };

    const result = computeCustomFilterSeries(onlyFilter1, emptyFilter2);

    expect(result.sortedKeys).toEqual(["Facet A", "Facet B"]);
  });
});

describe("categoryToDisplayName target awareness", () => {
  const data = ({
    ...baseData,
    filters: {
      color1: { name: "Color Context A" },
      color2: { name: "Color Context B" },
      facet1: { name: "Facet Context A" },
      facet2: { name: "Facet Context B" },
    },
  } as unknown) as DataExplorerPlotResponse;

  test("LEGEND_BOTH reads color1/color2 names for target 'color'", () => {
    // No default target: under the version-2 default flip, an absent
    // color_by defers to facet_by, so "color" is not a safe fallback —
    // every caller must resolve and pass the target explicitly.
    expect(categoryToDisplayName(LEGEND_BOTH, data, null, "color")).toBe(
      "Both (Color Context A & Color Context B)"
    );
  });

  test("LEGEND_BOTH reads facet1/facet2 names for target 'facet'", () => {
    expect(categoryToDisplayName(LEGEND_BOTH, data, null, "facet")).toBe(
      "Both (Facet Context A & Facet Context B)"
    );
  });
});

// Regression: LEGEND_NEITHER (a real, explicit "in neither selected
// context" bucket) and LEGEND_OTHER (missing/null data) used to share one
// symbol, forcing categoryToDisplayName to guess which text applied via a
// fragile heuristic (checking whether continuousBins happened to be set, or
// scanning the categorical data for a literal "Other" string). Distinct
// identities make both branches unconditional — no data-shape dependence.
describe("categoryToDisplayName: LEGEND_NEITHER vs LEGEND_OTHER", () => {
  test("LEGEND_NEITHER always reads as 'Other' — the real, explicit classification", () => {
    expect(categoryToDisplayName(LEGEND_NEITHER, baseData, null, "color")).toBe(
      "Other"
    );
  });

  test("LEGEND_OTHER always reads as 'N/A' — missing data — with no continuousBins", () => {
    expect(categoryToDisplayName(LEGEND_OTHER, baseData, null, "color")).toBe(
      "N/A"
    );
  });

  test("LEGEND_OTHER still reads as 'N/A' when continuousBins is present", () => {
    const bins = calcBins([1, 2, 3]);
    expect(categoryToDisplayName(LEGEND_OTHER, baseData, bins, "color")).toBe(
      "N/A"
    );
  });

  test("LEGEND_OTHER reads as 'N/A' even when the categorical data has a literal 'Other' value", () => {
    // The old heuristic scanned the categorical slice's own values for a
    // literal "Other" string to decide whether LEGEND_OTHER should read
    // "N/A" instead of "Other" — misfiring for any real dataset that
    // happens to have a category actually named "Other". LEGEND_OTHER now
    // always means "N/A", regardless of what the categorical data itself
    // contains.
    const dataWithLiteralOther = ({
      ...baseData,
      metadata: {
        color_property: {
          label: "Lineage",
          values: ["lung", "Other", "breast"],
          value_type: "categorical",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    expect(
      categoryToDisplayName(LEGEND_OTHER, dataWithLiteralOther, null, "color")
    ).toBe("N/A");
  });
});

describe("computeFacets", () => {
  const dataWithY = ({
    ...baseData,
    dimensions: {
      ...baseData.dimensions,
      y: { values: [1, 2, 3], value_type: "continuous" },
    },
  } as unknown) as DataExplorerPlotResponse;

  test("categorical: maps null values to the literal 'N/A' facet, facetOrder alphabetical with it last", () => {
    const data = ({
      ...dataWithY,
      metadata: {
        facet_property: {
          label: "Sex",
          values: ["male", null, "female"],
          value_type: "categorical",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "property");

    expect(result?.facetKeys).toEqual(["male", "N/A", "female"]);
    expect(result?.facetOrder).toEqual(["female", "male", "N/A"]);
    // Real category values are already valid colorMap keys as-is — no
    // translation needed there. "N/A" is the one exception: it
    // stringifies the same LEGEND_OTHER identity the color side uses for a
    // null categorical value, so it needs an entry to translate back.
    expect(result?.facetColorKeys).toEqual({ "N/A": LEGEND_OTHER });
  });

  test("categorical: facetOrder is case-insensitive natural sort, not plain ASCII", () => {
    // Plain ASCII/lexicographic sort would put "Banana" before "apple"
    // (uppercase sorts before lowercase); the natural/case-insensitive
    // collator used elsewhere in this file (compareLegendKeys) must not.
    const data = ({
      ...dataWithY,
      metadata: {
        facet_property: {
          label: "Fruit",
          values: ["cherry", "Banana", "apple"],
          value_type: "categorical",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "property");

    expect(result?.facetOrder).toEqual(["apple", "Banana", "cherry"]);
  });

  test("continuous: returns formatted range labels and an explicit ascending facetOrder", () => {
    const groupValues = [10, 20, 10, 20, 10, 20];
    const data = ({
      ...dataWithY,
      index_ids: groupValues.map((_, i) => `id${i}`),
      dimensions: {
        ...dataWithY.dimensions,
        x: { ...dataWithY.dimensions.x, values: groupValues.map((_, i) => i) },
        y: { values: groupValues.map((_, i) => i), value_type: "continuous" },
      },
      metadata: {
        facet_property: {
          label: "Score",
          values: groupValues,
          value_type: "continuous",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "property");

    expect(new Set(result?.facetKeys).size).toBe(2);
    expect(result?.facetOrder?.length).toBe(2);
  });

  // Regression: regressionLinesByFacet looks a facet's color up in colorMap
  // via facetColorKeys — colorMap is keyed by the raw LEGEND_RANGE_N symbol,
  // never by the formatted range text, so this map is the only way to find
  // it. facetColorKeys must map each formatted bin label back to its own
  // real LEGEND_RANGE_N symbol (not, say, all pointing at the same one).
  test("continuous: facetColorKeys maps each formatted bin label back to its own LEGEND_RANGE_N symbol", () => {
    const groupValues = [10, 20, 10, 20, 10, 20];
    const data = ({
      ...dataWithY,
      index_ids: groupValues.map((_, i) => `id${i}`),
      dimensions: {
        ...dataWithY.dimensions,
        x: { ...dataWithY.dimensions.x, values: groupValues.map((_, i) => i) },
        y: { values: groupValues.map((_, i) => i), value_type: "continuous" },
      },
      metadata: {
        facet_property: {
          label: "Score",
          values: groupValues,
          value_type: "continuous",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "property");

    expect(result?.facetOrder?.length).toBe(2);
    const colorKeys = result!.facetOrder!.map(
      (label) => result!.facetColorKeys![label]
    );
    // Each bin's own symbol, and no two bins collapse onto the same one.
    expect(new Set(colorKeys).size).toBe(2);
    colorKeys.forEach((key) => expect(typeof key).toBe("symbol"));
  });

  test("continuous: a null value's 'N/A' facet maps back to LEGEND_OTHER", () => {
    const groupValues = [10, 20, null, 10, 20, null];
    const data = ({
      ...dataWithY,
      index_ids: groupValues.map((_, i) => `id${i}`),
      dimensions: {
        ...dataWithY.dimensions,
        x: { ...dataWithY.dimensions.x, values: groupValues.map((_, i) => i) },
        y: { values: groupValues.map((_, i) => i), value_type: "continuous" },
      },
      metadata: {
        facet_property: {
          label: "Score",
          values: groupValues,
          value_type: "continuous",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "property");

    expect(result?.facetKeys).toContain("N/A");
    expect(result?.facetColorKeys?.["N/A"]).toBe(LEGEND_OTHER);
  });

  test("returns null when facet_by is unset", () => {
    expect(computeFacets(dataWithY, undefined)).toBeNull();
  });

  test("returns null when neither a categorical nor continuous facet source resolves", () => {
    const data = ({
      ...dataWithY,
      metadata: {},
    } as unknown) as DataExplorerPlotResponse;

    expect(computeFacets(data, "property")).toBeNull();
  });

  // Regression: facet_by "raw_slice"/"aggregated_slice" backed by
  // filters.facet1/facet2 used to be completely ignored — neither the
  // categorical nor continuous branch reads filters at all, so faceting
  // silently did nothing.
  test("custom-filter: facet1/facet2 partition into name1/name2/Both/Other facets", () => {
    const data = ({
      ...dataWithY,
      metadata: {},
      filters: {
        facet1: { name: "Lung", values: [true, true, false, false] },
        facet2: { name: "Breast", values: [true, false, true, false] },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "raw_slice");

    expect(result?.facetKeys).toEqual([
      "Both (Lung & Breast)",
      "Lung",
      "Breast",
      "Other",
    ]);
    expect(result?.facetOrder).toEqual([
      "Lung",
      "Breast",
      "Both (Lung & Breast)",
      "Other",
    ]);
    // Regression: regressionLinesByFacet's colorMap.get() must be able to
    // translate the formatted "Both"/"Other" text back to the real
    // LEGEND_BOTH/LEGEND_NEITHER symbols colorMap is actually keyed by —
    // otherwise the lookup silently misses and the line renders grey
    // instead of palette.compareBoth/palette.other. "Lung"/"Breast" are
    // already plain strings and valid colorMap keys, so they're absent here.
    expect(result?.facetColorKeys).toEqual({
      "Both (Lung & Breast)": LEGEND_BOTH,
      Other: LEGEND_NEITHER,
    });
  });

  // Regression: the drawn regression line's fallback (regressionLines in
  // useScatterPlotData.ts) needs to facet by color_by's own triad when
  // facet_by is unset — target "color" must read filters.color1/color2 and
  // metadata.color_property, not the facet triad, and produce the exact
  // same shape (including facetColorKeys) as target "facet" already does.
  describe("target 'color'", () => {
    test("categorical: reads metadata.color_property, not facet_property", () => {
      const data = ({
        ...dataWithY,
        metadata: {
          color_property: {
            label: "Sex",
            values: ["male", "female", "male"],
            value_type: "categorical",
          },
          // Present but must be ignored for target "color".
          facet_property: {
            label: "Score",
            values: [1, 2, 3],
            value_type: "continuous",
          },
        },
      } as unknown) as DataExplorerPlotResponse;

      const result = computeFacets(data, "property", "color");

      expect(result?.facetKeys).toEqual(["male", "female", "male"]);
    });

    test("custom-filter: reads filters.color1/color2, not facet1/facet2, with facetColorKeys for Both/Other", () => {
      const data = ({
        ...dataWithY,
        metadata: {},
        filters: {
          color1: { name: "Lung", values: [true, true, false, false] },
          color2: { name: "Breast", values: [true, false, true, false] },
          // Present but must be ignored for target "color".
          facet1: { name: "Skin", values: [false, false, false, false] },
        },
      } as unknown) as DataExplorerPlotResponse;

      const result = computeFacets(data, "raw_slice", "color");

      expect(result?.facetKeys).toEqual([
        "Both (Lung & Breast)",
        "Lung",
        "Breast",
        "Other",
      ]);
      expect(result?.facetColorKeys).toEqual({
        "Both (Lung & Breast)": LEGEND_BOTH,
        Other: LEGEND_NEITHER,
      });
    });
  });
});

describe("computeFacetedLinReg", () => {
  const linRegBase = ({
    dimensions: {
      x: { values: [1, 2, 3, 4, 5, 6], value_type: "continuous" },
      y: { values: [2, 4, 6, 8, 10, 12], value_type: "continuous" },
    },
    filters: {},
    metadata: {},
  } as unknown) as DataExplorerPlotResponse;

  test("categorical: one row per facet, alphabetically ordered, including 'N/A'", () => {
    const data = ({
      ...linRegBase,
      metadata: {
        facet_property: {
          label: "Facet",
          values: ["B", "B", "B", "A", "A", null],
          value_type: "categorical",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const rows = computeFacetedLinReg(data, "property");

    // "N/A" gets a row too, same as any other facet, since its
    // points are genuinely plottable (only the faceting annotation is
    // missing) — but it's sorted last, after the real category names.
    expect(rows.map((r) => r.group_label)).toEqual(["A", "B", "N/A"]);
  });

  test("custom-filter: 'Other' gets a fitted row — unlike 'N/A', it's a real classification", () => {
    const data = ({
      ...linRegBase,
      filters: {
        facet1: {
          name: "Lung",
          values: [true, true, true, false, false, false],
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const rows = computeFacetedLinReg(data, "raw_slice");

    expect(rows.map((r) => r.group_label)).toEqual(["Lung", "Other"]);
    // Both facets have 3 points each and should get real fitted stats.
    rows.forEach((r) => expect(r.number_of_points).toBe(3));
  });

  test("continuous: one row per represented bin, in ascending order — not lexicographic", () => {
    const groupValues = [10, 10, 20, 20, 10, 20];
    const data = ({
      ...linRegBase,
      metadata: {
        facet_property: {
          label: "Score",
          values: groupValues,
          value_type: "continuous",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const facetInfo = computeFacets(data, "property")!;
    const rows = computeFacetedLinReg(data, "property");

    expect(rows.length).toBe(2);
    // Must follow computeFacets' own ascending facetOrder, not a
    // lexicographic sort of the formatted range strings (which would
    // misorder e.g. "12.3 – 45.6" before "5.0 – 10.0").
    expect(rows.map((r) => r.group_label)).toEqual(facetInfo.facetOrder);
  });

  test("continuous: the 'N/A' bucket gets its own fitted row too, appended last", () => {
    const groupValues = [10, 10, 20, 20, null, null];
    const data = ({
      ...linRegBase,
      metadata: {
        facet_property: {
          label: "Score",
          values: groupValues,
          value_type: "continuous",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const rows = computeFacetedLinReg(data, "property");

    expect(rows.map((r) => r.group_label)).toContain("N/A");
    expect(rows[rows.length - 1].group_label).toBe("N/A");
    const noValueRow = rows.find((r) => r.group_label === "N/A")!;
    expect(noValueRow.number_of_points).toBe(2);
  });

  // Regression: the regression table's own fallback (LinearRegressionInfo)
  // needs to facet by color_by when facet_by is unset — `target` is
  // appended as the last param specifically so this 3-arg-with-`visible`
  // call shape below still works unchanged when target is omitted.
  test("target 'color': facets by filters.color1/color2, producing one fitted row per category", () => {
    const data = ({
      ...linRegBase,
      filters: {
        color1: {
          name: "Lung",
          values: [true, true, true, false, false, false],
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const rows = computeFacetedLinReg(data, "raw_slice", undefined, "color");

    expect(rows.map((r) => r.group_label)).toEqual(["Lung", "Other"]);
  });
});

describe("formatDataForWaterfall", () => {
  // Regression: `Object.values`/`Object.keys` never see Symbol-keyed
  // properties. formatDataForWaterfall buckets points by facet key and, when
  // the facet is continuous, those keys are LEGEND_RANGE_* symbols — so
  // `Object.values(buckets).forEach(...)` silently sorted zero buckets,
  // leaving each cluster's points in raw materialization order instead of
  // ascending by y. Visually: a scattered, Manhattan-plot-like cluster
  // instead of a smooth ascending "snake".
  test("sorts each cluster ascending by y even when facet keys are symbols (continuous facet_by)", () => {
    const N = 12;
    const yValues = [5, 1, 9, 3, 7, 2, 8, 4, 6, 0, 11, 10];
    // Two facets, alternating — deliberately uncorrelated with y so an
    // unsorted cluster would visibly fail an ascending check.
    const groupValues = [10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20];

    const data = ({
      dimensions: {
        x: { values: Array.from({ length: N }, (_, i) => i) },
        y: { values: yValues, value_type: "continuous" },
      },
      filters: {},
      metadata: {
        facet_property: {
          label: "Facet",
          values: groupValues,
          value_type: "continuous",
        },
      },
      index_ids: Array.from({ length: N }, (_, i) => `id${i}`),
      index_labels: Array.from({ length: N }, (_, i) => `label${i}`),
    } as unknown) as DataExplorerPlotResponse;

    const bins = calcBins(groupValues);
    const binned = computeContinuousLegendKeySeries(groupValues, bins)!;

    const formatted = formatDataForWaterfall(
      data,
      undefined,
      binned.sortedKeys,
      binned.series
    )!;

    // Facet the resulting (x, y) pairs by which facet each point belongs to,
    // then assert y is strictly ascending as x increases within each facet.
    const byFacet = new Map<number, { x: number; y: number }[]>();
    (formatted.x as number[]).forEach((x, i) => {
      const g = groupValues[i];
      if (!byFacet.has(g)) byFacet.set(g, []);
      byFacet.get(g)!.push({ x, y: yValues[i] });
    });

    byFacet.forEach((points) => {
      points.sort((a, b) => a.x - b.x);
      for (let i = 1; i < points.length; i += 1) {
        expect(points[i].y).toBeGreaterThan(points[i - 1].y);
      }
    });
  });

  // The remainder is one cluster, not one per category merged into it. Worth
  // pinning because the collapse and the clustering are computed separately —
  // collapseCategoricalSeries produces the series and keys, formatDataForWaterfall
  // buckets by them — and a mismatch between the two spellings of the remainder
  // key would silently leave those points with no x position at all.
  test("gathers the collapsed remainder into one contiguous run", () => {
    const cats = Array.from({ length: 20 }, (_, i) => `cat${i}`);
    const yValues = cats.map((_, i) => (i * 7) % 20);

    const data = ({
      index_ids: cats,
      index_labels: cats,
      dimensions: {
        x: { values: cats.map((_, i) => i), value_type: "continuous" },
        y: { values: yValues, value_type: "continuous" },
        facet: {
          values: cats,
          value_type: "categorical",
          label: "F",
          dataset_id: "d",
        },
      },
      filters: {},
      metadata: {},
    } as unknown) as DataExplorerPlotResponse;

    // Three categories kept; the other seventeen collapse.
    const collapsed = collapseCategoricalSeries<string>(
      cats,
      data.dimensions as any,
      data.filters as any,
      (cats as unknown) as LegendKey[],
      ["cat0", "cat1", "cat2"],
      REMAINDER_FACET
    );

    const formatted = formatDataForWaterfall(
      data,
      "property" as any,
      collapsed.sortedKeys as (string | symbol)[],
      collapsed.series,
      "facet"
    )!;

    const x = formatted.x as number[];
    const remainderX = collapsed.series
      .map((key, i) => (key === REMAINDER_FACET ? x[i] : null))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    expect(remainderX).toHaveLength(17);
    // Contiguous: no other category's point sits between the first and last.
    expect(remainderX[remainderX.length - 1] - remainderX[0]).toBe(16);
  });
});

describe("calcDensityStats", () => {
  // calcDensityStats' 4th param is the RESOLVED color mode (see
  // resolveColorMode) — never a raw color_by, since color_by can itself be
  // "facet"/"uniform" (version 2). These tests are only exercising the
  // color_by="property" case, so the resolved pair is always this.
  const colorModeProperty = {
    mode: "property" as const,
    target: "color" as const,
  };

  test("unset facet_by means no faceting — a single LEGEND_ALL track — not a fallback to color_by", () => {
    const result = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      undefined
    );

    expect(result.sortedFacetKeys).toEqual([LEGEND_ALL]);
    expect(result.facetData).toEqual([LEGEND_ALL, LEGEND_ALL, LEGEND_ALL]);
    // colorData is unaffected — it still reflects color_by="property".
    expect(result.colorData).toEqual(["lung", "breast", "lung"]);
  });

  // Regression: DataExplorerDensity1DPlot gated its "Facets" panel on
  // `Boolean(sortedFacetKeys)`, which the test above shows is true even with no
  // faceting at all — so an unfaceted density plot grew a panel whose only row
  // was "All". The scatter and the waterfall ask predicates that mean what they
  // say, which is why neither showed it. Fed from calcDensityStats rather than
  // a hand-built array, since the placeholder track is its output.
  test("a lone LEGEND_ALL track is not a facet partition", () => {
    const unfaceted = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      undefined
    );

    const faceted = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      "property"
    );

    expect(hasRealFacetPartition(unfaceted.sortedFacetKeys)).toBe(false);
    expect(hasRealFacetPartition(faceted.sortedFacetKeys)).toBe(true);
  });

  test("explicit facet_by reads its own independent triad, even when color_by is also 'property'", () => {
    const result = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      "property"
    );

    expect(result.colorData).toEqual(["lung", "breast", "lung"]);
    expect(result.facetData).toEqual(["male", "female", "female"]);
  });

  // Regression: the density plot drew the automatic selection no matter what
  // the user picked, because calcDensityStats had no parameter to receive the
  // chosen categories and so never passed one down to
  // computeDensitySeriesForMode. The legend, the waterfall and the scatter all
  // read the chosen list by their own routes, so density was the only renderer
  // out of sync with the panel sitting next to it.
  test("honors hand-picked color categories", () => {
    const result = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      undefined,
      null,
      false,
      { color: ["lung"] }
    );

    // "breast" wasn't picked, so it shares the remainder rather than keeping a
    // curve of its own.
    expect(result.colorData).toEqual(["lung", LEGEND_REMAINDER, "lung"]);
  });

  test("honors hand-picked facet categories", () => {
    const result = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      "property",
      null,
      false,
      { facet: ["female"] }
    );

    expect(result.facetData).toEqual([LEGEND_REMAINDER, "female", "female"]);
    // The other side is untouched by a facet-only selection.
    expect(result.colorData).toEqual(["lung", "breast", "lung"]);
  });

  test("falls back to the automatic selection when nothing is picked", () => {
    // The reason the bug hid: with few enough categories the automatic ranking
    // keeps them all, so an absent selection and a complete one look alike.
    const result = calcDensityStats(
      baseData,
      null,
      undefined,
      colorModeProperty,
      "property",
      null,
      false,
      {}
    );

    expect(result.colorData).toEqual(["lung", "breast", "lung"]);
    expect(result.facetData).toEqual(["male", "female", "female"]);
  });

  // Regression: facet_by "property" selected in the dropdown but not yet
  // backed by a chosen annotation (metadata.facet_property genuinely absent
  // from the response, since the fetch never requested one) used to still
  // split into one violin track per color category — a visible,
  // awkward in-between state that would vanish on reload (normalizePlot
  // strips an incomplete facet_by). It must instead render identically to
  // facet_by being fully unset: a single LEGEND_ALL track.
  test("facet_by set but not yet backed by real data renders identically to unset — no in-between faceting state", () => {
    const unbackedData = ({
      ...baseData,
      filters: {},
      metadata: {
        color_property: baseData.metadata!.color_property,
        // No facet_property.
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = calcDensityStats(
      unbackedData,
      null,
      undefined,
      colorModeProperty,
      "property"
    );

    expect(result.sortedFacetKeys).toEqual([LEGEND_ALL]);
    expect(result.facetData).toEqual([LEGEND_ALL, LEGEND_ALL, LEGEND_ALL]);
    // colorData is unaffected — it still reflects color_by="property".
    expect(result.colorData).toEqual(["lung", "breast", "lung"]);
  });

  // Regression: a continuous facet_property used to silently fail to facet
  // at all unless color_by ALSO happened to be continuous — because (1)
  // `continuousBins` was color-derived only, so facet's own continuous
  // fallback either got null bins (color not continuous) or color's WRONG
  // bin boundaries (color continuous but a different slice), and (2) the
  // continuous branch never produced `sortedKeys`, so the density renderer's
  // `facetKeysProp ?? colorKeys` fallback silently substituted color's
  // legend keys for track identity/order.
  describe("continuous facet_property", () => {
    const continuousData = ({
      ...baseData,
      metadata: {
        // A non-continuous color_property, deliberately NOT matching the
        // facet's continuous scale — pins that faceting doesn't depend on
        // color being continuous too.
        color_property: {
          label: "Lineage",
          values: ["lung", "breast", "lung"],
          value_type: "categorical",
        },
        facet_property: {
          label: "Score",
          values: [10, 20, 30],
          value_type: "continuous",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    test("facets by its own bins even when color_by is not continuous", () => {
      const facetContinuousBins = calcBins([10, 20, 30]);

      const result = calcDensityStats(
        continuousData,
        null, // color's continuousBins: null, since color_by isn't continuous
        undefined,
        colorModeProperty,
        "property",
        facetContinuousBins
      );

      // sortedFacetKeys must be populated (previously undefined for any
      // continuous mode), and must NOT be color's keys (["lung", "breast"]
      // are categorical strings, not Range symbols).
      expect(result.sortedFacetKeys).toBeDefined();
      expect(result.sortedFacetKeys!.length).toBeGreaterThan(0);
      result.sortedFacetKeys!.forEach((key) => {
        expect(typeof key).toBe("symbol");
      });

      // Every point lands in some bin (none left unbound).
      expect(result.facetData).not.toContain(undefined);
    });

    test("uses facet's own bin boundaries, not color's, when both are continuous", () => {
      const colorContinuousData = ({
        ...continuousData,
        metadata: {
          ...continuousData.metadata,
          color_property: {
            label: "Other Continuous",
            values: [1000, 2000, 3000],
            value_type: "continuous",
          },
        },
      } as unknown) as DataExplorerPlotResponse;

      const colorContinuousBins = calcBins([1000, 2000, 3000]);
      const facetContinuousBins = calcBins([10, 20, 30]);

      const result = calcDensityStats(
        colorContinuousData,
        colorContinuousBins,
        undefined,
        colorModeProperty,
        "property",
        facetContinuousBins
      );

      // Both sides bin all 3 points into distinct bins (bins are computed
      // from each axis's own min/max), regardless of the wildly different
      // scales — proof the two never share `continuousBins`.
      expect(new Set(result.colorData).size).toBe(3);
      expect(new Set(result.facetData).size).toBe(3);
    });
  });

  // Regression: facet_by "raw_slice"/"aggregated_slice" backed by
  // filters.facet1/facet2 DID route through the same custom-filter branch
  // color_by uses, but that branch never returned `sortedKeys` — so
  // `sortedFacetKeys` was `undefined`, and the density renderer's
  // `facetKeysProp ?? colorKeys` fallback silently substituted color's keys.
  describe("custom-filter facet_by (facet1/facet2)", () => {
    const customFilterData = ({
      ...baseData,
      // No metadata.facet_property here — baseData's own "Sex" categorical
      // property would otherwise win the categorical branch before the
      // custom-filter fallback is ever reached.
      metadata: {
        color_property: baseData.metadata!.color_property,
      },
      filters: {
        facet1: { name: "Lung", values: [true, false, false] },
        facet2: { name: "Breast", values: [false, true, false] },
      },
    } as unknown) as DataExplorerPlotResponse;

    test("returns real sortedFacetKeys, independent of color_by's own state", () => {
      const result = calcDensityStats(
        customFilterData,
        null,
        undefined,
        colorModeProperty, // color_by unrelated to facet's filters
        "raw_slice"
      );

      expect(result.sortedFacetKeys).toEqual([
        "Lung",
        "Breast",
        LEGEND_NEITHER,
      ]);
      expect(result.facetData).toEqual(["Lung", "Breast", LEGEND_NEITHER]);
      // colorData is unaffected — still reflects color_by="property".
      expect(result.colorData).toEqual(["lung", "breast", "lung"]);
    });
  });

  // The Facets panel seeds its default-hidden set from unusedFacetKeys,
  // mirroring how the Legend panel seeds from unusedKeys — a facet category
  // with nothing to plot must start toggled off, not fully on.
  describe("unusedFacetKeys (facet side's own no-data keys)", () => {
    // "female"'s points are all null on x, so that facet has no data to
    // plot. Deliberately NO filters.visible: a missing visible filter means
    // everything is visible, and must not disable the no-data bookkeeping
    // (it used to — unusedKeys were only computed when a visible filter
    // happened to exist).
    const dataWithEmptyFacet = ({
      ...baseData,
      dimensions: {
        x: {
          ...(baseData.dimensions as any).x,
          values: [1, 2, null, null],
        },
      },
      filters: {},
      metadata: {
        color_property: {
          label: "Lineage",
          values: ["lung", "breast", "lung", "breast"],
          value_type: "categorical",
        },
        facet_property: {
          label: "Sex",
          values: ["male", "male", "female", "female"],
          value_type: "categorical",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    test("flags a facet whose points are all null on x, even with no visible filter", () => {
      const result = calcDensityStats(
        dataWithEmptyFacet,
        null,
        undefined,
        colorModeProperty,
        "property"
      );

      expect(result.unusedFacetKeys).toEqual(new Set(["female"]));
      // The color side's own bookkeeping is independent: "breast" has one
      // non-null point (index 1), so nothing is flagged there.
      expect(result.unusedKeys).toEqual(new Set());
    });

    test("is an empty set when facet_by is unset (single LEGEND_ALL track)", () => {
      const result = calcDensityStats(
        dataWithEmptyFacet,
        null,
        undefined,
        colorModeProperty,
        undefined
      );

      expect(result.unusedFacetKeys).toEqual(new Set());
    });
  });

  // The equivalent configuration (color_by defers to facet_by "expansion",
  // so the Legend panel doubles as the facet key): no-data expansion members
  // must appear in the legend's key list AND be flagged as unused — listed
  // but toggled off by default — rather than dropped from the list entirely
  // (which is what includeEmpty=false used to do to the color side).
  describe("expanded plots (facet_by 'expansion' with color deferring)", () => {
    const colorModeExpansion = {
      mode: "expansion" as const,
      target: "facet" as const,
    };

    const expandedData = ({
      ...baseData,
      dimensions: {
        x: {
          ...(baseData.dimensions as any).x,
          values: [1, 2, null],
        },
      },
      filters: {},
      metadata: {},
      expansions: [
        {
          slice_type: "transcript",
          display_name: "Transcript",
          labels: ["T1", "T2", "T3"],
        },
      ],
    } as unknown) as DataExplorerPlotResponse;

    test("no-data members are listed in sortedColorKeys and flagged in unusedKeys", () => {
      const result = calcDensityStats(
        expandedData,
        null,
        undefined,
        colorModeExpansion,
        "expansion",
        null,
        true // isExpanded
      );

      // T3's only point is null on x — still listed (toggled off), on both
      // the color side (the Legend panel doubles as the facet key here) and
      // the facet side.
      expect(result.sortedColorKeys).toEqual(["T1", "T2", "T3"]);
      expect(result.unusedKeys).toEqual(new Set(["T3"]));
      expect(result.sortedFacetKeys).toEqual(["T1", "T2", "T3"]);
      expect(result.unusedFacetKeys).toEqual(new Set(["T3"]));
    });
  });
});

describe("getLegendKeysWithNoData", () => {
  test("flags a category whose points are all unplottable, even with no visible filter", () => {
    const data = ({
      ...baseData,
      dimensions: {
        x: {
          ...(baseData.dimensions as any).x,
          values: [1, null, null],
        },
      },
      filters: {},
    } as unknown) as DataExplorerPlotResponse;

    // "breast"'s only point (index 1) is null on x; "lung" still has index 0.
    expect(getLegendKeysWithNoData(data, null, "property")).toEqual(
      new Set(["breast"])
    );
  });

  test("a point null on y is unplottable too (scatter)", () => {
    const data = ({
      ...baseData,
      dimensions: {
        x: { ...(baseData.dimensions as any).x, values: [1, 2, 3] },
        y: {
          ...(baseData.dimensions as any).x,
          axis_label: "y",
          values: [1, null, 3],
        },
      },
      filters: {},
    } as unknown) as DataExplorerPlotResponse;

    // "breast"'s only point (index 1) is null on y.
    expect(getLegendKeysWithNoData(data, null, "property")).toEqual(
      new Set(["breast"])
    );
  });

  test("reads the facet triad when target is 'facet'", () => {
    const data = ({
      ...baseData,
      dimensions: {
        x: {
          ...(baseData.dimensions as any).x,
          values: [1, 2, null],
        },
      },
      filters: {},
    } as unknown) as DataExplorerPlotResponse;

    // facet_property is ["male", "female", "female"]; "female" still has a
    // plottable point at index 1, so nothing is flagged — proof it reads
    // facet's own values, not color's (["lung", "breast", "lung"], where
    // index 2's null x would not have flagged anything either way).
    expect(getLegendKeysWithNoData(data, null, "property", "facet")).toEqual(
      new Set()
    );
  });
});

describe("resolveColorMode", () => {
  const config = (
    color_by?: DataExplorerPlotConfig["color_by"],
    facet_by?: DataExplorerPlotConfig["facet_by"]
  ) =>
    (({ color_by, facet_by } as unknown) as Pick<
      DataExplorerPlotConfig,
      "color_by" | "facet_by"
    >);

  test("absent color_by defers to facet_by (the v2 default)", () => {
    expect(resolveColorMode(config(undefined, "property"))).toEqual({
      mode: "property",
      target: "facet",
    });
  });

  test("absent color_by AND absent facet_by resolves to facet target with an undefined mode (uniform-equivalent)", () => {
    // Mirrors facet_by's own already-existing "unset" behavior: every
    // target-aware helper's "no match found" fallthrough already treats an
    // undefined mode/no facet backing as uniform, so this doesn't need its
    // own special case anywhere.
    expect(resolveColorMode(config(undefined, undefined))).toEqual({
      mode: undefined,
      target: "facet",
    });
  });

  test("'facet' resolves the same way as absent — defers to facet_by", () => {
    expect(resolveColorMode(config("facet", "custom"))).toEqual({
      mode: "custom",
      target: "facet",
    });
  });

  test("'facet' with no facet_by backing resolves to facet target with an undefined mode", () => {
    expect(resolveColorMode(config("facet", undefined))).toEqual({
      mode: undefined,
      target: "facet",
    });
  });

  test("'uniform' resolves to an undefined mode on the color target, regardless of facet_by", () => {
    expect(resolveColorMode(config("uniform", "property"))).toEqual({
      mode: undefined,
      target: "color",
    });
  });

  test("'uniform' resolves the same way even with a stale/complete facet_by present", () => {
    expect(resolveColorMode(config("uniform", "raw_slice"))).toEqual({
      mode: undefined,
      target: "color",
    });
  });

  test("explicit non-sentinel color_by values pass through unchanged, on the color target", () => {
    expect(resolveColorMode(config("property", "custom"))).toEqual({
      mode: "property",
      target: "color",
    });

    expect(resolveColorMode(config("raw_slice", undefined))).toEqual({
      mode: "raw_slice",
      target: "color",
    });

    expect(resolveColorMode(config("expansion", "property"))).toEqual({
      mode: "expansion",
      target: "color",
    });
  });
});

describe("getColorMap — LEGEND_ALL swatch", () => {
  // Regression: the legend's "All" swatch must match whatever color the
  // points/violins/panels actually render (PrototypeDensity1D's
  // hasRealFacetBacking, PrototypeScatterPlot's hasFacetOptionsEnabled,
  // getSolidColorGroups' fallback) — it was previously always palette.all
  // regardless of facet_by, leaving the legend showing the wrong color once
  // those renderers started using a neutral fill.
  //
  // findCategoricalSlice ignores `mode` entirely except for "expansion" — it
  // just checks whatever's structurally present in the response for the
  // given target — so these fixtures must NOT carry baseData's own
  // color_property/facet_property unless the scenario actually calls for
  // it (a real fetch response only ever includes the metadata the plot
  // config's own dimensions/metadata actually requested).
  test("uses palette.all when neither facet_by nor color_by resolves to anything", () => {
    const data = ({
      ...baseData,
      metadata: {},
    } as unknown) as DataExplorerPlotResponse;
    const plotConfig = ({
      color_by: "uniform",
    } as unknown) as DataExplorerPlotConfig;

    const colorMap = getColorMap(data, plotConfig, DEFAULT_PALETTE);

    expect(colorMap.get(LEGEND_ALL)).toBe(DEFAULT_PALETTE.all);
  });

  test("uses NEUTRAL_FACET_FILL when facet_by has real backing but color_by resolves to nothing", () => {
    const data = ({
      ...baseData,
      metadata: { facet_property: baseData.metadata!.facet_property },
    } as unknown) as DataExplorerPlotResponse;
    const plotConfig = ({
      facet_by: "property",
      color_by: "uniform",
    } as unknown) as DataExplorerPlotConfig;

    const colorMap = getColorMap(data, plotConfig, DEFAULT_PALETTE);

    expect(colorMap.get(LEGEND_ALL)).toBe(NEUTRAL_FACET_FILL);
  });
});

describe("getColorMap — continuous property with null values", () => {
  // Regression: a null-valued point in a continuous color_property/
  // facet_property used to get its own LEGEND_OTHER ("N/A") legend entry —
  // colorMap.set(LEGEND_OTHER, ...) below always ran — but density_1d/
  // waterfall's sortedLegendKeys reorder step (`getColorMap`'s last
  // `if (sortedLegendKeys)` branch) silently dropped it again, because
  // sortedLegendKeys was built from computeContinuousLegendKeySeries, which
  // never included LEGEND_OTHER. Passing a sortedLegendKeys array here
  // reproduces exactly what useDensity1DPlotData/useWaterfallPlotData do —
  // scatter never hits this (it doesn't pass sortedLegendKeys at all).
  test("keeps the LEGEND_OTHER entry after reordering by sortedLegendKeys", () => {
    const data = ({
      ...baseData,
      dimensions: {
        ...baseData.dimensions,
        // The redirect described in useScatterPlotData/breadboxMethods.ts's
        // "HACK! I never imagined there would be continuous metadata"
        // comment: a continuous color_property arrives as dimensions.color,
        // not metadata.color_property.
        color: {
          axis_label: "Expression",
          dataset_id: "expression-dataset",
          slice_type: "gene",
          values: [1, null, 3],
          value_type: "continuous",
        },
      },
      metadata: {},
    } as unknown) as DataExplorerPlotResponse;
    const plotConfig = ({} as unknown) as DataExplorerPlotConfig;

    const bins = calcBins([1, null, 3]);
    const binned = computeContinuousLegendKeySeries([1, null, 3], bins)!;

    const colorMap = getColorMap(
      data,
      plotConfig,
      DEFAULT_PALETTE,
      binned.sortedKeys
    );

    expect(colorMap.has(LEGEND_OTHER)).toBe(true);
  });

  // Regression: density_1d and waterfall pass a sortedLegendKeys array built
  // from the *data*, so it names every category — including the ones the
  // ranking collapsed. Reordering by it used to re-add those with an undefined
  // color, putting them back in the legend as blank rows that backed no points
  // and did nothing when toggled, and dropping the remainder bucket (which is
  // not a category, so never appears in that order) from the map entirely —
  // taking it out of the paint path too.
  test("drops collapsed categories on reorder, and keeps the remainder", () => {
    const colorMap = new Map<LegendKey, string>([
      ["kept", "#111111"],
      [LEGEND_REMAINDER, REMAINDER_FILL],
      [LEGEND_OTHER, "#bdbdbd"],
    ]);

    const reordered = reorderColorMap(colorMap, [
      "kept",
      "collapsed",
      "alsoCollapsed",
      LEGEND_OTHER,
    ]);

    expect([...reordered.keys()]).toEqual([
      "kept",
      LEGEND_REMAINDER,
      LEGEND_OTHER,
    ]);
    expect(reordered.get(LEGEND_REMAINDER)).toBe(REMAINDER_FILL);
  });
});

describe("orderColorKeysByCount", () => {
  // The reported scenario: colored by transcript, faceted by lineage. Inside
  // the collapsed-lineage panel one transcript has far more points than the
  // other, and was burying it.
  const colorMap = new Map<LegendKey, string>([
    ["ENST-big", "#111111"],
    ["ENST-small", "#222222"],
    [LEGEND_REMAINDER, REMAINDER_FILL],
  ]);

  // 40 points in the bucket panel: 38 of the big transcript, 2 of the small.
  // Elsewhere the proportions are reversed, which is the whole point — a global
  // count would order both panels the same way and get one of them wrong.
  const colorData: LegendKey[] = [
    ...new Array(38).fill("ENST-big"),
    ...new Array(2).fill("ENST-small"),
    ...new Array(2).fill("ENST-big"),
    ...new Array(38).fill("ENST-small"),
  ];

  const facetData: LegendKey[] = [
    ...new Array(40).fill(LEGEND_REMAINDER),
    ...new Array(40).fill("Lung"),
  ];

  const visible = new Array(80).fill(true);

  test("orders by the count within the facet, smallest first", () => {
    // Callers reverse their trace list, so first here is drawn last — on top.
    // No remainder-*colored* points in this panel, so that key drops out —
    // the bucket here is a collapsed lineage, not a collapsed transcript.
    expect(
      orderColorKeysByCount(
        colorMap,
        colorData,
        facetData,
        LEGEND_REMAINDER,
        visible
      )
    ).toEqual(["ENST-small", "ENST-big"]);

    // Same colors, opposite order, because the panel differs. This is what a
    // global count cannot express.
    expect(
      orderColorKeysByCount(colorMap, colorData, facetData, "Lung", visible)
    ).toEqual(["ENST-big", "ENST-small"]);
  });

  test("breaks a tie on spread, putting the tight cluster on top", () => {
    // The case that matters, and the one count cannot touch: coloring by an
    // expansion member gives every color exactly one point per index entity,
    // so every group is the same size. Here both transcripts have 20 points in
    // the panel; one is a tight clump, the other is spread across the axis.
    const tied = new Map<LegendKey, string>([
      ["ENST-tight", "#111111"],
      ["ENST-diffuse", "#222222"],
    ]);

    const cData: LegendKey[] = [
      ...new Array(20).fill("ENST-tight"),
      ...new Array(20).fill("ENST-diffuse"),
    ];

    const fData: LegendKey[] = new Array(40).fill(LEGEND_REMAINDER);
    const vis = new Array(40).fill(true);

    const xs = [
      ...new Array(20).fill(0).map((_, i) => 5 + i * 0.01),
      ...new Array(20).fill(0).map((_, i) => i * 2),
    ];

    // First is drawn last, on top — so the clump, which would otherwise vanish
    // under the spread-out one.
    expect(
      orderColorKeysByCount(tied, cData, fData, LEGEND_REMAINDER, vis, [xs])
    ).toEqual(["ENST-tight", "ENST-diffuse"]);

    // Without positions there is nothing to break the tie with, and the order
    // is left alone rather than invented.
    expect(
      orderColorKeysByCount(tied, cData, fData, LEGEND_REMAINDER, vis)
    ).toEqual(["ENST-tight", "ENST-diffuse"]);
  });

  test("count still wins when it differs", () => {
    const tied = new Map<LegendKey, string>([
      ["few-but-spread", "#111111"],
      ["many-but-tight", "#222222"],
    ]);

    const cData: LegendKey[] = [
      ...new Array(3).fill("few-but-spread"),
      ...new Array(40).fill("many-but-tight"),
    ];

    const fData: LegendKey[] = new Array(43).fill(LEGEND_REMAINDER);
    const vis = new Array(43).fill(true);

    const xs = [
      0,
      50,
      100,
      ...new Array(40).fill(0).map((_, i) => 5 + i * 0.01),
    ];

    // Spread is only a tiebreak. Three points still need protecting from forty
    // more than a tight clump needs protecting from a scattering.
    expect(
      orderColorKeysByCount(tied, cData, fData, LEGEND_REMAINDER, vis, [xs])
    ).toEqual(["few-but-spread", "many-but-tight"]);
  });

  test("drops colors with no points in the facet", () => {
    const absent: LegendKey[] = new Array(80).fill("ENST-big");

    expect(
      orderColorKeysByCount(
        colorMap,
        absent,
        facetData,
        LEGEND_REMAINDER,
        visible
      )
    ).toEqual(["ENST-big"]);
  });

  test("keeps the remainder color at the bottom", () => {
    const withBucket: LegendKey[] = [
      ...new Array(39).fill(LEGEND_REMAINDER),
      "ENST-small",
      ...new Array(40).fill("ENST-big"),
    ];

    // Last in the array is drawn first, at the bottom — even though the bucket
    // is by far the largest group here.
    const order = orderColorKeysByCount(
      colorMap,
      withBucket,
      facetData,
      LEGEND_REMAINDER,
      visible
    );

    expect(order[order.length - 1]).toBe(LEGEND_REMAINDER);
  });
});

describe("collapsed categories resolve to the remainder bucket", () => {
  // Every consumer that turns a point's category into a legend key has to agree
  // on which categories still have one. They each used to decide separately,
  // and each broke differently once categories started being collapsed: blank
  // legend rows, a bucket toggle that moved nothing, phantom density curves.
  const shownCategories = {
    shown: new Set(["kept"]),
    hasRemainder: true,
  };

  test("a collapsed category maps to the bucket, a kept one to itself", () => {
    const toLegendKey = makeLegendKeyResolver(shownCategories);

    expect(toLegendKey("kept")).toBe("kept");
    expect(toLegendKey("collapsed")).toBe(LEGEND_REMAINDER);
  });

  test("a null maps to N/A, not to the bucket", () => {
    // The two grey buckets mean different things — "no value" versus "has a
    // value, just not one of the ones shown" — and a point must land in the
    // right one.
    const toLegendKey = makeLegendKeyResolver(shownCategories);

    expect(toLegendKey(null)).toBe(LEGEND_OTHER);
  });

  test("computeFacets collapses to a shared panel, ordered before N/A", () => {
    // The facet identity and the density series resolve the same points, so
    // they have to agree on which categories survive. When they didn't, the
    // series put a point in the remainder while the order still listed its
    // category, and the panel rendered as empty vertical space.
    const values = [
      ...new Array(30).fill(0).map((_, i) => `cat${i}`),
      ...new Array(30).fill("big"),
      null,
    ];

    const data = ({
      dimensions: {
        x: { values: values.map((_, i) => i % 7) },
      },
      filters: {},
      metadata: {
        facet_property: {
          label: "Thing",
          values,
          value_type: "categorical",
        },
      },
    } as unknown) as DataExplorerPlotResponse;

    const result = computeFacets(data, "property", "facet");

    expect(result?.facetOrder).toContain(REMAINDER_FACET);
    expect(result?.facetKeys).toContain(REMAINDER_FACET);

    // Both catch-alls last, collapsed before missing.
    const order = result!.facetOrder!;
    expect(order.indexOf(REMAINDER_FACET)).toBe(order.length - 2);
    expect(order[order.length - 1]).toBe("N/A");

    expect(result?.facetColorKeys?.[REMAINDER_FACET]).toBe(LEGEND_REMAINDER);
  });

  test("nothing is rerouted when nothing was collapsed", () => {
    const toLegendKey = makeLegendKeyResolver({
      shown: new Set(["a"]),
      hasRemainder: false,
    });

    // "b" isn't in `shown` here only because the caller's set is partial;
    // with no remainder there is nowhere to reroute it to, so it stays itself
    // rather than vanishing into a bucket that isn't on the plot.
    expect(toLegendKey("b")).toBe("b");
  });
});

describe("getColorMap — custom-filter 'neither' bucket", () => {
  // Regression companion to the continuous-null test above: a point in
  // neither of two selected raw_slice/aggregated_slice contexts is a real,
  // explicit classification (displays "Other"), not missing data (displays
  // "N/A") — it must get the distinct LEGEND_NEITHER identity, not
  // LEGEND_OTHER, even though both used the same palette.other color.
  test("uses LEGEND_NEITHER, not LEGEND_OTHER, for points in neither selected context", () => {
    const data = ({
      ...baseData,
      metadata: {},
      filters: {
        color1: { name: "Group A", values: [true, false, false] },
        color2: { name: "Group B", values: [false, true, false] },
      },
    } as unknown) as DataExplorerPlotResponse;
    const plotConfig = ({
      color_by: "raw_slice",
    } as unknown) as DataExplorerPlotConfig;

    const colorMap = getColorMap(data, plotConfig, DEFAULT_PALETTE);

    expect(colorMap.get(LEGEND_NEITHER)).toBe(DEFAULT_PALETTE.other);
    expect(colorMap.has(LEGEND_OTHER)).toBe(false);
  });
});

describe("calcVisibility — custom-filter 'neither' bucket", () => {
  test("hiding LEGEND_NEITHER hides only points in neither selected context", () => {
    const data = ({
      ...baseData,
      metadata: {},
      filters: {
        color1: { name: "Group A", values: [true, false, false] },
        color2: { name: "Group B", values: [false, true, false] },
      },
    } as unknown) as DataExplorerPlotResponse;

    const visible = calcVisibility(
      data,
      new Set([LEGEND_NEITHER]),
      null,
      undefined,
      "raw_slice",
      "color"
    );

    expect(visible).toEqual([true, true, false]);
  });
});
