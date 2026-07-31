import { DataExplorerPlotConfig, DataExplorerPlotResponse } from "@depmap/types";
import {
  calcBins,
  calcDensityStats,
  categoryToDisplayName,
  computeContinuousLegendKeySeries,
  computeCustomFilterSeries,
  computeFacetedLinReg,
  computeFacets,
  DEFAULT_PALETTE,
  findCategoricalSlice,
  findContinuousColorSlice,
  formatDataForWaterfall,
  getColorMap,
  LEGEND_ALL,
  LEGEND_BOTH,
  LEGEND_OTHER,
  NEUTRAL_FACET_FILL,
  resolveColorMode,
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
      LEGEND_OTHER,
    ]);
  });

  test("sortedKeys is the canonical [name1, name2, Both, Other] order, filtered to represented", () => {
    const result = computeCustomFilterSeries(filter1, filter2);

    expect(result.sortedKeys).toEqual([
      "Facet A",
      "Facet B",
      LEGEND_BOTH,
      LEGEND_OTHER,
    ]);
  });

  test("only one filter selected: Both is never included, even filtered names still appear", () => {
    const result = computeCustomFilterSeries(filter1, undefined);

    expect(result.series).toEqual(["Facet A", "Facet A", LEGEND_OTHER, LEGEND_OTHER]);
    expect(result.sortedKeys).toEqual(["Facet A", LEGEND_OTHER]);
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
    // LEGEND_BOTH/LEGEND_OTHER symbols colorMap is actually keyed by —
    // otherwise the lookup silently misses and the line renders grey
    // instead of palette.compareBoth/palette.other. "Lung"/"Breast" are
    // already plain strings and valid colorMap keys, so they're absent here.
    expect(result?.facetColorKeys).toEqual({
      "Both (Lung & Breast)": LEGEND_BOTH,
      Other: LEGEND_OTHER,
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
        Other: LEGEND_OTHER,
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
        facet1: { name: "Lung", values: [true, true, true, false, false, false] },
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
        color1: { name: "Lung", values: [true, true, true, false, false, false] },
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
});

describe("calcDensityStats", () => {
  // calcDensityStats' 4th param is the RESOLVED color mode (see
  // resolveColorMode) — never a raw color_by, since color_by can itself be
  // "facet"/"uniform" (version 2). These tests are only exercising the
  // color_by="property" case, so the resolved pair is always this.
  const colorModeProperty = { mode: "property" as const, target: "color" as const };

  test("unset facet_by means no faceting — a single LEGEND_ALL track — not a fallback to color_by", () => {
    const result = calcDensityStats(baseData, null, undefined, colorModeProperty, undefined);

    expect(result.sortedFacetKeys).toEqual([LEGEND_ALL]);
    expect(result.facetData).toEqual([LEGEND_ALL, LEGEND_ALL, LEGEND_ALL]);
    // colorData is unaffected — it still reflects color_by="property".
    expect(result.colorData).toEqual(["lung", "breast", "lung"]);
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

      expect(result.sortedFacetKeys).toEqual(["Lung", "Breast", LEGEND_OTHER]);
      expect(result.facetData).toEqual(["Lung", "Breast", LEGEND_OTHER]);
      // colorData is unaffected — still reflects color_by="property".
      expect(result.colorData).toEqual(["lung", "breast", "lung"]);
    });
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
    const data = ({ ...baseData, metadata: {} } as unknown) as DataExplorerPlotResponse;
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
