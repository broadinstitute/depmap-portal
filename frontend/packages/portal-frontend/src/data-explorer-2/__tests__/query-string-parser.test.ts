import qs from "qs";
import { parseShorthandParams } from "src/data-explorer-2/query-string-parser";

const MOCK_DATASETS_BY_INDEX_TYPE = {
  depmap_model: [
    {
      data_type: "CRISPR",
      dataset_id: "Chronos_Combined",
      entity_type: "gene",
      index_type: "depmap_model",
      label: "CRISPR (DepMap Internal 23Q2+Score, Chronos)",
      units: "Gene effect",
      priority: 42,
    },
  ],
  gene: [
    {
      data_type: "CRISPR",
      dataset_id: "Chronos_Combined",
      entity_type: "depmap_model",
      index_type: "gene",
      label: "CRISPR (DepMap Internal 23Q2+Score, Chronos)",
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
      entity_type: "gene",
      axis_type: "entity",
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
      entity_type: "depmap_model",
      axis_type: "context",
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

  it("should infer `index_type` from `dataset_id` and `entity_type`", () => {
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
