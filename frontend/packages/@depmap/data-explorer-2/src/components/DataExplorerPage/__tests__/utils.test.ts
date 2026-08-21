import pako from "pako";
import { Base64 } from "js-base64";
import { DataExplorerPlotConfig } from "@depmap/types";
import {
  canSwapColorAndFacet,
  CURRENT_PLOT_VERSION,
  getColorFacetSwapMode,
  normalizePlot,
  plotToQueryString,
  readPlotFromQueryString,
  toRelatedPlot,
} from "../utils";

// Mirrors the private `compress()` in utils.ts (pako deflate + url-safe
// base64), so tests can mint a raw `p` param payload without normalizePlot
// or plotToQueryString rewriting it first — needed to simulate a pre-v2
// wire payload exactly as an old bookmarked link would have stored it.
const compress = (obj: object): string => {
  const json = JSON.stringify(obj);
  const bytes = pako.deflate(json);
  return Base64.fromUint8Array(bytes, true);
};

const setQueryString = (search: string) => {
  window.history.pushState(null, "", search);
};

// `toRelatedPlot` pins the selection-to-context translation: given a plot
// the user is looking at and a set of selected IDs, return the plot that
// "drills into" those selections. The tests below assert the post-refactor
// contract: the input selection set is always real Breadbox IDs and the
// emitted context expressions reference them directly via `given_id` — no
// label↔id translation, no per-dimension-type special cases.
//
// Tests against the gene-index-type cases (3 and 6) fail against the
// current implementation, because today `toRelatedPlot` routes non-
// depmap_model dimensions through a label→id lookup and the input set is
// labels, not IDs.

// Shared identifiers fixture: a mix of feature-type (gene) and
// sample-type (depmap_model) rows so every case below can pull from one
// array. `toRelatedPlot` takes `identifiers` as an explicit argument
// (no I/O), which makes these tests pure-function with no mocks.
const identifiers = [
  { id: "ENSG00000164687", label: "FABP5" },
  { id: "ENSG00000181449", label: "SOX2" },
  { id: "ENSG00000176697", label: "BDNF" },
  { id: "ACH-000425", label: "NIHOVCAR3" },
  { id: "ACH-000552", label: "HT29" },
  { id: "ACH-000001", label: "MCF7" },
];

// Helper: build the minimal scatter plot the tests need as input.
const scatterPlot = (
  indexType: string,
  sliceType: string
): DataExplorerPlotConfig =>
  (({
    plot_type: "scatter",
    index_type: indexType,
    dimensions: {
      x: {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: sliceType,
        dataset_id: "Chronos_Combined",
        context: {
          name: "FABP5",
          context_type: sliceType,
          expr: { "==": [{ var: "entity_label" }, "FABP5"] },
        },
      },
    },
  } as unknown) as DataExplorerPlotConfig);

// Helper: build the minimal correlation-heatmap plot the tests need as
// input. The heatmap branch reads slice_type off the X dimension; the
// index_type is preserved through the transform (no flip).
const heatmapPlot = (
  indexType: string,
  sliceType: string
): DataExplorerPlotConfig =>
  (({
    plot_type: "correlation_heatmap",
    index_type: indexType,
    dimensions: {
      x: {
        axis_type: "aggregated_slice",
        aggregation: "correlation",
        slice_type: sliceType,
        dataset_id: "Chronos_Combined",
        context: {
          name: "All",
          context_type: sliceType,
          expr: true,
        },
      },
    },
  } as unknown) as DataExplorerPlotConfig);

// Pull the `given_id` value out of an `==` expression so tests can
// assert against it without caring about expression shape.
const givenIdOf = (context: unknown): unknown => {
  const expr = (context as { expr: unknown }).expr as {
    "=="?: [{ var: string }, unknown];
  };
  return expr["=="]?.[1];
};

// Pull the array of ids out of an `in` expression.
const inIdsOf = (context: unknown): unknown => {
  const expr = (context as { expr: unknown }).expr as {
    in?: [{ var: string }, unknown[]];
  };
  return expr.in?.[1];
};

describe("toRelatedPlot", () => {
  describe("scatter plot (non-heatmap path)", () => {
    test("model index + 1 selected model id → density_1d with given_id of the id", () => {
      const plot = scatterPlot("depmap_model", "gene");
      const selected = new Set(["ACH-000425"]);

      const next = toRelatedPlot(plot, selected, identifiers);

      expect(next.plot_type).toBe("density_1d");
      // Index/slice flip: the new index_type is what was the X slice_type.
      expect(next.index_type).toBe("gene");
      expect(next.dimensions.x?.slice_type).toBe("depmap_model");
      expect(givenIdOf(next.dimensions.x?.context)).toBe("ACH-000425");
    });

    test("model index + 2 selected model ids → scatter with two single-slice contexts", () => {
      const plot = scatterPlot("depmap_model", "gene");
      const selected = new Set(["ACH-000425", "ACH-000552"]);

      const next = toRelatedPlot(plot, selected, identifiers);

      expect(next.plot_type).toBe("scatter");
      expect(next.index_type).toBe("gene");
      // The order of iteration over a Set is insertion order in JS.
      expect(givenIdOf(next.dimensions.x?.context)).toBe("ACH-000425");
      expect(givenIdOf(next.dimensions.y?.context)).toBe("ACH-000552");
    });

    test("gene index + 1 selected gene id → density_1d with given_id of the id", () => {
      const plot = scatterPlot("gene", "depmap_model");
      const selected = new Set(["ENSG00000181449"]);

      const next = toRelatedPlot(plot, selected, identifiers);

      expect(next.plot_type).toBe("density_1d");
      expect(next.index_type).toBe("depmap_model");
      expect(next.dimensions.x?.slice_type).toBe("gene");
      // This is the case that fails pre-refactor: today the impl does
      // labelToIdMap["ENSG00000181449"] which is undefined, because the
      // input is an id, not a label, and the map is keyed by label.
      expect(givenIdOf(next.dimensions.x?.context)).toBe("ENSG00000181449");
    });

    test("model index + 3 selected model ids → correlation_heatmap with `in` listing all ids", () => {
      const plot = scatterPlot("depmap_model", "gene");
      const selected = new Set(["ACH-000425", "ACH-000552", "ACH-000001"]);

      const next = toRelatedPlot(plot, selected, identifiers);

      expect(next.plot_type).toBe("correlation_heatmap");
      expect(next.index_type).toBe("gene");
      expect(next.dimensions.x?.slice_type).toBe("depmap_model");
      expect(inIdsOf(next.dimensions.x?.context)).toEqual([
        "ACH-000425",
        "ACH-000552",
        "ACH-000001",
      ]);
    });
  });

  describe("correlation heatmap (heatmap path)", () => {
    test("model slice + 1 selected model id → density_1d, index_type preserved (no flip)", () => {
      const plot = heatmapPlot("depmap_model", "depmap_model");
      const selected = new Set(["ACH-000425"]);

      const next = toRelatedPlot(plot, selected, identifiers);

      expect(next.plot_type).toBe("density_1d");
      // Heatmap branch does NOT flip index_type; it stays the same as input.
      expect(next.index_type).toBe("depmap_model");
      expect(next.dimensions.x?.slice_type).toBe("depmap_model");
      expect(givenIdOf(next.dimensions.x?.context)).toBe("ACH-000425");
    });

    test("gene slice + 1 selected gene id → density_1d, index_type preserved (no flip)", () => {
      // Note: this exercises a less-common shape — a gene-by-gene heatmap.
      // The index_type and slice_type both being non-model lets us see the
      // "non-inverted, non-model" path explicitly, which is the case that
      // pre-refactor would have routed through labelToIdMap and failed.
      const plot = heatmapPlot("gene", "gene");
      const selected = new Set(["ENSG00000181449"]);

      const next = toRelatedPlot(plot, selected, identifiers);

      expect(next.plot_type).toBe("density_1d");
      expect(next.index_type).toBe("gene");
      expect(next.dimensions.x?.slice_type).toBe("gene");
      // Pre-refactor: labelToIdMap["ENSG00000181449"] === undefined.
      expect(givenIdOf(next.dimensions.x?.context)).toBe("ENSG00000181449");
    });
  });
});

describe("normalizePlot", () => {
  // Minimal valid plot used as the base fixture.
  const basePlot: DataExplorerPlotConfig = ({
    plot_type: "scatter",
    index_type: "depmap_model",
    dimensions: {
      x: {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "FABP5",
          dimension_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "FABP5"] },
          vars: {},
        },
      },
    },
  } as unknown) as DataExplorerPlotConfig;

  test("version survives normalizePlot — stamped payloads must round-trip the field", () => {
    // If version were pulled into the destructure, this would return undefined
    // and the writer would serialize a version-less blob, defeating the versioning
    // scheme. Fail loudly here rather than silently at the reader's gate.
    const result = normalizePlot({
      ...basePlot,
      version: CURRENT_PLOT_VERSION,
    });
    expect(result.version).toBe(CURRENT_PLOT_VERSION);
  });

  // `sort_by` used to be re-added only inside the `color_by` arms, so it survived
  // normalization only when some color backing happened to be complete. These pin
  // the fix: sort order is a property of the plot, not of its coloring.
  describe("sort_by preservation", () => {
    test("survives with no color_by and no facet_by", () => {
      // The Transcript Explorer regression: a plot with `sort_by: "alphabetical"`
      // matched no color arm, so `plotToQueryString` serialized it without a
      // `sort_by` and the setting vanished on refresh.
      const result = normalizePlot(({
        ...basePlot,
        sort_by: "alphabetical",
      } as unknown) as DataExplorerPlotConfig);

      expect(result.sort_by).toBe("alphabetical");
    });

    test("survives when faceted but uncolored", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "expansion",
        sort_by: "alphabetical",
      } as unknown) as DataExplorerPlotConfig);

      expect(result.sort_by).toBe("alphabetical");
    });

    test("is absent when the plot never had one", () => {
      expect(normalizePlot(basePlot).sort_by).toBeUndefined();
    });
  });

  // `facet_by` used to be destructured off the top and never re-added in any
  // branch, so it was silently dropped from every serialized plot — set it
  // through the UI and it vanished on the next `plotToQueryString` round trip
  // (e.g. on reload, or on any Transcript Explorer history push). These pin
  // the fix for the two facet_by modes actually wired today.
  describe("facet_by preservation", () => {
    test("'expansion' survives when expand_by is present", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "expansion",
        expand_by: [
          {
            slice_type: "transcript",
            context: {
              name: "All",
              dimension_type: "transcript",
              expr: true,
              vars: {},
            },
          },
        ],
      } as unknown) as DataExplorerPlotConfig);

      expect(result.facet_by).toBe("expansion");
    });

    test("'expansion' is dropped when expand_by is absent", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "expansion",
      } as unknown) as DataExplorerPlotConfig);

      expect(result.facet_by).toBeUndefined();
    });

    test("'property' survives with a valid metadata.facet_property", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "property",
        metadata: {
          facet_property: {
            dataset_id: "lineage-dataset",
            identifier: "lineage",
            identifier_type: "column",
          },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.facet_by).toBe("property");
      expect(result.metadata?.facet_property).toEqual({
        dataset_id: "lineage-dataset",
        identifier: "lineage",
        identifier_type: "column",
      });
    });

    test("'property' is dropped when metadata.facet_property is missing", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "property",
      } as unknown) as DataExplorerPlotConfig);

      expect(result.facet_by).toBeUndefined();
    });

    test("survival is independent of color_by's own state", () => {
      // color_by is "property" but its metadata backing (color_property) is
      // incomplete, so color_by must be dropped. facet_by is a separate
      // "property" mode backed by its own, valid facet_property — it must
      // survive regardless, and the incomplete color_property must not ride
      // along with it (ADR 0002 §3: survival must not couple to an
      // unrelated field's state).
      const result = normalizePlot(({
        ...basePlot,
        color_by: "property",
        facet_by: "property",
        metadata: {
          color_property: { dataset_id: "incomplete-dataset" },
          facet_property: {
            dataset_id: "lineage-dataset",
            identifier: "lineage",
            identifier_type: "column",
          },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
      expect(result.facet_by).toBe("property");
      expect(result.metadata?.facet_property).toEqual({
        dataset_id: "lineage-dataset",
        identifier: "lineage",
        identifier_type: "column",
      });
      expect(result.metadata?.color_property).toBeUndefined();
    });

    test("'raw_slice'/'aggregated_slice' survive with a facet1/facet2 filter", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "raw_slice",
        filters: {
          facet1: { name: "Facet A", context_type: "depmap_model", expr: true },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.facet_by).toBe("raw_slice");
      expect(result.filters?.facet1).toEqual({
        name: "Facet A",
        context_type: "depmap_model",
        expr: true,
      });
    });

    test("facet1/facet2 survive independently of color1/color2", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "raw_slice",
        facet_by: "raw_slice",
        filters: {
          color1: { name: "Color A", context_type: "depmap_model", expr: true },
          facet1: { name: "Facet A", context_type: "depmap_model", expr: true },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.filters?.color1).toEqual({
        name: "Color A",
        context_type: "depmap_model",
        expr: true,
      });
      expect(result.filters?.facet1).toEqual({
        name: "Facet A",
        context_type: "depmap_model",
        expr: true,
      });
    });

    test("'custom' survives with a complete dimensions.facet, without reintroducing an incomplete dimensions.color", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "custom",
        facet_by: "custom",
        dimensions: {
          ...basePlot.dimensions,
          // Incomplete: no dataset_id/context, so color_by must be dropped
          // and dimensions.color stripped.
          color: { axis_type: "raw_slice", slice_type: "gene" },
          facet: {
            axis_type: "raw_slice",
            aggregation: "first",
            slice_type: "gene",
            dataset_id: "Chronos_Combined",
            context: {
              name: "SOX2",
              dimension_type: "gene",
              expr: { "==": [{ var: "entity_label" }, "SOX2"] },
              vars: {},
            },
          },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
      expect(result.dimensions?.color).toBeUndefined();
      expect(result.facet_by).toBe("custom");
      expect(result.dimensions?.facet).toEqual({
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "SOX2",
          dimension_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "SOX2"] },
          vars: {},
        },
      });
    });
  });

  // A `color_by`/`facet_by` set without its own complete backing (metadata/
  // filters/dimension) must be normalized away entirely — treated as if it
  // were never set — rather than surviving because some *unrelated* field
  // happens to be present/valid. This is what keeps an in-progress selection
  // (e.g. picking "Annotation" from the type dropdown before choosing which
  // annotation) from ever reaching plotToQueryString/history: normalizePlot
  // strips it, so plotsAreEquivalentWhenSerialized sees no change and no
  // history entry is pushed until the user completes the selection.
  describe("color_by/facet_by completeness", () => {
    test("color_by 'property' with empty metadata is dropped, not vacuously complete", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "property",
        metadata: {},
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
    });

    test("color_by 'property' is dropped when metadata holds only the unrelated facet_property", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "property",
        facet_by: "property",
        metadata: {
          facet_property: {
            dataset_id: "lineage-dataset",
            identifier: "lineage",
            identifier_type: "column",
          },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
      // facet_property itself is unaffected — facet_by has its own valid backing.
      expect(result.metadata?.facet_property).toBeDefined();
    });

    test("facet_by 'property' with empty metadata is dropped, not vacuously complete", () => {
      const result = normalizePlot(({
        ...basePlot,
        facet_by: "property",
        metadata: {},
      } as unknown) as DataExplorerPlotConfig);

      expect(result.facet_by).toBeUndefined();
    });

    test("an unrelated filters.facet1 does not leak through via color_by's own (complete) filters.color1", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "raw_slice",
        // facet_by is unset, so facet1 has no owner and must not survive.
        filters: {
          color1: { name: "Color A", context_type: "depmap_model", expr: true },
          facet1: {
            name: "Stale Facet A",
            context_type: "depmap_model",
            expr: true,
          },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBe("raw_slice");
      expect(result.filters?.color1).toBeDefined();
      expect(result.filters?.facet1).toBeUndefined();
    });

    test("filters.color2 alone does not survive when color_by itself is unset", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: undefined,
        filters: {
          color2: { name: "Color B", context_type: "depmap_model", expr: true },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
      expect(result.filters?.color2).toBeUndefined();
    });
  });

  // `color_by: "facet"` (v2, ADR 0001/0004) defers entirely to facet_by's own
  // resolution and has no backing of its own. `color_by: "uniform"` is the
  // opposite: an explicit "no color regardless of facet_by" sentinel that is
  // NOT equivalent to absence post-v2 (absence now means "facet").
  describe("color_by 'facet'/'uniform' handling (v2)", () => {
    test("'facet' with no backing is stripped (survives as absent, not as 'facet')", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "facet",
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
    });

    test("'uniform' survives unconditionally, even with stale color backing present", () => {
      const result = normalizePlot(({
        ...basePlot,
        color_by: "uniform",
        dimensions: {
          ...basePlot.dimensions,
          color: {
            axis_type: "raw_slice",
            aggregation: "first",
            slice_type: "gene",
            dataset_id: "Chronos_Combined",
            context: {
              name: "SOX2",
              dimension_type: "gene",
              expr: { "==": [{ var: "entity_label" }, "SOX2"] },
              vars: {},
            },
          },
        },
        filters: {
          color1: { name: "Color A", context_type: "depmap_model", expr: true },
        },
        metadata: {
          color_property: {
            dataset_id: "lineage-dataset",
            identifier: "lineage",
            identifier_type: "column",
          },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBe("uniform");
    });

    test("'facet' is still stripped even with a complete filters.color1 present", () => {
      // Regression test for the tightened `color_by_has_own_backing` guard:
      // "facet" has no backing of ITS OWN, so a leftover (stale) color1
      // filter must not resurrect it.
      const result = normalizePlot(({
        ...basePlot,
        color_by: "facet",
        filters: {
          color1: { name: "Color A", context_type: "depmap_model", expr: true },
        },
      } as unknown) as DataExplorerPlotConfig);

      expect(result.color_by).toBeUndefined();
    });
  });
});

describe("readPlotFromQueryString / plotToQueryString — v1->v2 color_by migration", () => {
  afterEach(() => {
    setQueryString("/");
  });

  // Minimal valid v2-context scatter plot fixture, used both for hand-built
  // "legacy payload" simulations and for round-trip tests through
  // plotToQueryString. Avoids anything that would trigger a network call on
  // read (slice_id metadata, hashed contexts, shorthand params).
  const v2Plot: DataExplorerPlotConfig = ({
    plot_type: "scatter",
    index_type: "depmap_model",
    dimensions: {
      x: {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "FABP5",
          dimension_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "FABP5"] },
          vars: {},
        },
      },
      y: {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "SOX2",
          dimension_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "SOX2"] },
          vars: {},
        },
      },
    },
  } as unknown) as DataExplorerPlotConfig;

  test("a pre-v2 payload with absent color_by migrates to 'uniform'", async () => {
    const legacyPayload = { ...v2Plot, version: 1 };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("uniform");
  });

  test("a pre-v2 payload with absent color_by but a POPULATED facet_by still migrates to 'uniform'", async () => {
    // The case called out in ADR 0004: under v1, color_by never deferred to
    // facet_by, so a v1 payload with a set facet_by and no color_by must
    // still become "uniform" — not silently start matching that facet_by
    // under v2 read-back semantics.
    const legacyPayload = {
      ...v2Plot,
      version: 1,
      facet_by: "expansion",
      expand_by: [
        {
          slice_type: "transcript",
          context: {
            name: "All",
            dimension_type: "transcript",
            expr: true,
            vars: {},
          },
        },
      ],
    };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("uniform");
    expect(result.facet_by).toBe("expansion");
  });

  test("a payload with no version at all (coerced to 0) also migrates to 'uniform'", async () => {
    const legacyPayload = { ...v2Plot };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("uniform");
  });

  test("a v2 payload with color_by already set is left untouched by the migration", async () => {
    const legacyPayload = {
      ...v2Plot,
      version: 2,
      color_by: "uniform" as const,
    };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("uniform");
  });

  test("round-trip: color_by 'uniform' survives plotToQueryString -> readPlotFromQueryString", async () => {
    setQueryString("/");
    const search = await plotToQueryString(({
      ...v2Plot,
      color_by: "uniform",
    } as unknown) as DataExplorerPlotConfig);

    setQueryString(search);
    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("uniform");
  });

  test("round-trip: color_by 'facet' has no backing so it normalizes to absent, which then reads back as the v2 default (defer to facet_by)", async () => {
    // normalizePlot deliberately strips "facet" (item 4 of the plan) since
    // post-v2 absence already means "facet" — so plotToQueryString never
    // serializes the literal string. Confirms that omission round-trips to
    // the same effective meaning rather than asserting the literal string
    // survives (it should not).
    setQueryString("/");
    const search = await plotToQueryString(({
      ...v2Plot,
      color_by: "facet",
    } as unknown) as DataExplorerPlotConfig);

    setQueryString(search);
    const result = await readPlotFromQueryString();

    expect(result.color_by).toBeUndefined();
  });

  test("a pre-v2 payload with only color_by ('property') moves its value and backing to facet_by", async () => {
    // Under v1, color_by was the only axis — its value drove color AND
    // faceting simultaneously. Migrating a v1 payload's real color_by (and
    // its backing) over to facet_by, with color_by rewritten to "facet",
    // keeps it rendering identically under v2's independent axes.
    const legacyPayload = {
      ...v2Plot,
      version: 1,
      color_by: "property" as const,
      metadata: {
        color_property: {
          dataset_id: "lineage-dataset",
          identifier: "lineage",
          identifier_type: "column",
        },
      },
    };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("facet");
    expect(result.facet_by).toBe("property");
    expect(result.metadata?.facet_property).toEqual({
      dataset_id: "lineage-dataset",
      identifier: "lineage",
      identifier_type: "column",
    });
    expect(result.metadata?.color_property).toBeUndefined();
  });

  test("a pre-v2 payload with color_by 'aggregated_slice' moves filters.color1/color2 to facet1/facet2", async () => {
    const legacyPayload = {
      ...v2Plot,
      version: 1,
      color_by: "aggregated_slice" as const,
      filters: {
        color1: {
          name: "Facet A",
          dimension_type: "depmap_model",
          expr: true,
          vars: {},
        },
        color2: {
          name: "Facet B",
          dimension_type: "depmap_model",
          expr: true,
          vars: {},
        },
      },
    };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("facet");
    expect(result.facet_by).toBe("aggregated_slice");
    expect(result.filters?.facet1).toEqual(legacyPayload.filters.color1);
    expect(result.filters?.facet2).toEqual(legacyPayload.filters.color2);
    expect(result.filters?.color1).toBeUndefined();
    expect(result.filters?.color2).toBeUndefined();
  });

  test("a pre-v2 payload with color_by 'custom' moves dimensions.color to dimensions.facet", async () => {
    const legacyPayload = {
      ...v2Plot,
      version: 1,
      color_by: "custom" as const,
      dimensions: {
        ...v2Plot.dimensions,
        color: {
          axis_type: "raw_slice",
          aggregation: "first",
          slice_type: "gene",
          dataset_id: "Chronos_Combined",
          context: {
            name: "KRAS",
            dimension_type: "gene",
            expr: { "==": [{ var: "entity_label" }, "KRAS"] },
            vars: {},
          },
        },
      },
    };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("facet");
    expect(result.facet_by).toBe("custom");
    expect(result.dimensions?.facet).toEqual(legacyPayload.dimensions.color);
    expect((result.dimensions as { color?: unknown })?.color).toBeUndefined();
  });

  test("a pre-v2 payload with color_by and an already-populated facet_by is left untouched by this migration", async () => {
    // Defensive gate: a genuine v1 payload can never already have a
    // facet_by (it didn't exist yet), so this is an impossible-in-practice
    // case — but the migration must skip rather than clobber if it's ever
    // seen (e.g. a hand-authored payload).
    const legacyPayload = {
      ...v2Plot,
      version: 1,
      color_by: "property" as const,
      facet_by: "expansion" as const,
      metadata: {
        color_property: {
          dataset_id: "lineage-dataset",
          identifier: "lineage",
          identifier_type: "column",
        },
      },
    };
    setQueryString(`?p=${compress(legacyPayload)}`);

    const result = await readPlotFromQueryString();

    expect(result.color_by).toBe("property");
    expect(result.facet_by).toBe("expansion");
    expect(result.metadata?.color_property).toEqual({
      dataset_id: "lineage-dataset",
      identifier: "lineage",
      identifier_type: "column",
    });
  });
});

// The button in ViewOptions both shows itself and names itself from this, so a
// mode that comes back wrong is a mislabeled action rather than a missing one.
describe("getColorFacetSwapMode", () => {
  const completeProperty = {
    dataset_id: "d",
    identifier: "lineage",
    identifier_type: "column",
  };

  // raw_slice on color (backed by filters.color1), property on facet (backed by
  // metadata.facet_property) — two different real modes, both complete.
  const bothAxes = {
    color_by: "raw_slice",
    facet_by: "property",
    filters: { color1: { name: "Color 1" } },
    metadata: { facet_property: completeProperty },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  it("calls a two-way exchange a swap", () => {
    expect(getColorFacetSwapMode(bothAxes)).toBe("swap");
  });

  it("calls an unset facet_by a promote", () => {
    // Color's selection moves to facet and color_by becomes "facet", so both
    // axes end up showing the one partition — which is what the button says.
    expect(getColorFacetSwapMode({ ...bothAxes, facet_by: undefined })).toBe(
      "promote"
    );
  });

  it("calls a color_by that defers to facet_by a demote", () => {
    // Facet's selection moves to color and facet_by is unset, leaving color
    // alone — again what the button says.
    const deferring = {
      color_by: "facet",
      facet_by: "property",
      metadata: { facet_property: completeProperty },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    expect(getColorFacetSwapMode(deferring)).toBe("demote");
    // An absent color_by means the same thing in version 2, so it must not
    // report a different action.
    expect(getColorFacetSwapMode({ ...deferring, color_by: undefined })).toBe(
      "demote"
    );
  });

  it("reports no mode when there is nothing well-defined to do", () => {
    // Both axes resolving to the same thing: a swap would be a visible no-op.
    expect(
      getColorFacetSwapMode({
        color_by: "property",
        facet_by: "property",
        metadata: {
          color_property: completeProperty,
          facet_property: completeProperty,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).toBeNull();

    // "uniform" is a deliberate, complete choice rather than a deferred one,
    // so it is not demoted out from under the user.
    expect(
      getColorFacetSwapMode({
        color_by: "uniform",
        facet_by: "property",
        metadata: { facet_property: completeProperty },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).toBeNull();

    // Nothing on either axis.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getColorFacetSwapMode({} as any)).toBeNull();
  });

  it("agrees with canSwapColorAndFacet, which is derived from it", () => {
    const cases = [
      bothAxes,
      { ...bothAxes, facet_by: undefined },
      { color_by: "uniform", facet_by: "property" },
      {},
    ];

    cases.forEach((plot) => {
      expect(canSwapColorAndFacet(plot as never)).toBe(
        getColorFacetSwapMode(plot as never) !== null
      );
    });
  });
});
