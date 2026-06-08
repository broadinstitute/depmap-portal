import { DataExplorerPlotConfig } from "@depmap/types";
import { toRelatedPlot } from "../utils";

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
