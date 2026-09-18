import qs from "qs";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import { parseShorthandParams } from "../query-string-parser";
import { CURRENT_PLOT_VERSION } from "../plot-version";

const MOCK_DATASETS_BY_INDEX_TYPE: Record<
  string,
  DataExplorerDatasetDescriptor[]
> = {
  depmap_model: [
    {
      data_type: "CRISPR",
      id: "1",
      given_id: "Chronos_Combined",
      slice_type: "gene",
      index_type: "depmap_model",
      name: "CRISPR (DepMap Internal 23Q2+Score, Chronos)",
      units: "Gene effect",
      priority: 42,
    },
  ],
  gene: [
    {
      data_type: "CRISPR",
      id: "1",
      given_id: "Chronos_Combined",
      slice_type: "depmap_model",
      index_type: "gene",
      name: "CRISPR (DepMap Internal 23Q2+Score, Chronos)",
      units: "Gene effect",
      priority: 42,
    },
  ],
};

const xContext = encodeURIComponent(
  JSON.stringify({
    name: "Test context",
    context_type: "depmap_model",
    expr: true,
  })
);

describe("Data Explorer 2.0 query string parser", () => {
  it("should return `null` if there are no relevant params to parse", () => {
    const result = parseShorthandParams({ foo: "bar" }, {});
    expect(result).toBeNull();
  });

  it("should throw if known params are present but insufficient to plot anything", () => {
    const parseIncomplete = () => {
      parseShorthandParams({ xDataset: "Chronos_Combined" }, {});
    };

    expect(parseIncomplete).toThrow();
  });

  it("should flesh out a complete dimension from just a dataset ID and a feature", () => {
    const result = parseShorthandParams(
      {
        xDataset: "Chronos_Combined",
        xFeature: "SOX10",
      },
      MOCK_DATASETS_BY_INDEX_TYPE
    );

    expect(result?.dimensions?.x).toBeDefined();
    expect(result!.dimensions.x).toEqual({
      dataset_id: "Chronos_Combined",
      slice_type: "gene",
      axis_type: "raw_slice",
      aggregation: "first",
      context: {
        name: "SOX10",
        context_type: "gene",
        expr: { "==": [{ var: "entity_label" }, "SOX10"] },
      },
    });
  });

  it("should flesh out a complete dimension from just a dataset ID and a context", () => {
    const result = parseShorthandParams(
      {
        xDataset: "Chronos_Combined",
        xContext,
      },
      MOCK_DATASETS_BY_INDEX_TYPE
    );

    expect(result?.dimensions?.x).toBeDefined();
    expect(result!.dimensions.x).toEqual({
      dataset_id: "Chronos_Combined",
      slice_type: "depmap_model",
      axis_type: "aggregated_slice",
      aggregation: "mean",
      context: {
        name: "Test context",
        context_type: "depmap_model",
        expr: true,
      },
    });
  });

  it("should throw if an invalid context is passed", () => {
    const parseBadContext = () => {
      parseShorthandParams(
        { xDataset: "Chronos_Combined", xContext: "42" },
        {}
      );
    };

    expect(parseBadContext).toThrow();
  });

  it("should infer `plot_type` from the number of dimensions", () => {
    const params1 = {
      xDataset: "Chronos_Combined",
      xFeature: "SOX10",
    };
    const result1 = parseShorthandParams(params1, MOCK_DATASETS_BY_INDEX_TYPE);

    expect(result1).toBeDefined();
    expect(result1?.plot_type).toEqual("density_1d");

    const params2 = {
      xDataset: "Chronos_Combined",
      yDataset: "Chronos_Combined",
      xFeature: "SOX10",
      yFeature: "TP53",
    };
    const result2 = parseShorthandParams(params2, MOCK_DATASETS_BY_INDEX_TYPE);

    expect(result2).toBeDefined();
    expect(result2?.plot_type).toEqual("scatter");
  });

  it("should stamp the current schema version", () => {
    // Shorthand params are a mint point. An unstamped plot would coerce to
    // version 0 at the reader and get migrated as though it were pre-versioning
    // legacy, even though it was minted this second.
    const result = parseShorthandParams(
      {
        xDataset: "Chronos_Combined",
        xFeature: "SOX10",
      },
      MOCK_DATASETS_BY_INDEX_TYPE
    );

    expect(result?.version).toEqual(CURRENT_PLOT_VERSION);
  });

  describe("`color_property` on a 1D plot", () => {
    const color_property = "slice/lineage/1/label";

    it("should be both colored and faceted", () => {
      // Legacy (version 1) behavior: a single axis drove coloring and
      // faceting at once. Post-ADR-0004/0005 that takes the two-axis form,
      // and since this is a version-2 mint point the v1 -> v2 migration that
      // would have translated it never runs. See facetOnColorPropertyFor1d.
      const result = parseShorthandParams(
        {
          xDataset: "Chronos_Combined",
          xFeature: "SOX10",
          color_property,
        },
        MOCK_DATASETS_BY_INDEX_TYPE
      );

      expect(result?.plot_type).toEqual("density_1d");
      expect(result?.facet_by).toEqual("property");
      expect(result?.metadata?.facet_property).toEqual({
        slice_id: color_property,
      });

      // "facet" (not "property") so the two axes share one partition rather
      // than resolving two independent ones off the same slice.
      expect(result?.color_by).toEqual("facet");
      expect(result?.metadata?.color_property).toBeUndefined();
    });

    it("should still sort facets by mean", () => {
      const result = parseShorthandParams(
        {
          xDataset: "Chronos_Combined",
          xFeature: "SOX10",
          color_property,
        },
        MOCK_DATASETS_BY_INDEX_TYPE
      );

      expect(result?.sort_by).toEqual("mean_values_asc");
    });

    it("should color but NOT facet a scatter", () => {
      // A real facet_by on a scatter renders as small multiples, which legacy
      // `color_property` never did there.
      const result = parseShorthandParams(
        {
          xDataset: "Chronos_Combined",
          yDataset: "Chronos_Combined",
          xFeature: "SOX10",
          yFeature: "TP53",
          color_property,
        },
        MOCK_DATASETS_BY_INDEX_TYPE
      );

      expect(result?.plot_type).toEqual("scatter");
      expect(result?.facet_by).toBeUndefined();
      expect(result?.metadata?.facet_property).toBeUndefined();
      expect(result?.color_by).toEqual("property");
      expect(result?.metadata?.color_property).toEqual({
        slice_id: color_property,
      });
    });

    it("should treat `colorDataset` + `colorFeature` identically", () => {
      const result = parseShorthandParams(
        {
          xDataset: "Chronos_Combined",
          xFeature: "SOX10",
          colorDataset: "lineage",
          colorFeature: "1",
        },
        MOCK_DATASETS_BY_INDEX_TYPE
      );

      expect(result?.facet_by).toEqual("property");
      expect(result?.color_by).toEqual("facet");
      expect(result?.metadata?.facet_property).toEqual({
        slice_id: "slice/lineage/1/label",
      });
    });

    it("should be `uniform` when there is nothing to color by at all", () => {
      // Reaching the uniform arm means no facet_by was set either, so an
      // absent color_by would read back as "facet" and match nothing.
      const result = parseShorthandParams(
        {
          xDataset: "Chronos_Combined",
          xFeature: "SOX10",
        },
        MOCK_DATASETS_BY_INDEX_TYPE
      );

      expect(result?.color_by).toEqual("uniform");
      expect(result?.facet_by).toBeUndefined();
      expect(result?.sort_by).toBeUndefined();
    });
  });

  it("should infer `index_type` from `dataset_id` and `slice_type`", () => {
    const result = parseShorthandParams(
      {
        xDataset: "Chronos_Combined",
        xContext,
      },
      MOCK_DATASETS_BY_INDEX_TYPE
    );

    expect(result).toBeDefined();
    expect(result?.index_type).toEqual("gene");
  });
});
