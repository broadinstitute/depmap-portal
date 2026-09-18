import {
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
} from "@depmap/types";
import { buildTableConfig, dimensionToSliceQuery } from "../showExportCsvModal";

// A real config a user hit this with: two literal genes (SOX10, SOX11)
// plotted against each other. Each axis's context has no `vars` at all —
// the identifying "6663"/"6664" lives entirely in `expr` — which is
// exactly the shape an earlier version of dimensionToSliceQuery missed
// (it only looked at `vars`, so this fell back to a CustomColumn instead
// of a real slice).
const geneDimension = (
  name: string,
  given_id: string
): DataExplorerPlotConfigDimension =>
  (({
    axis_type: "raw_slice",
    aggregation: "first",
    context: {
      dimension_type: "gene",
      name,
      expr: { "==": [{ var: "given_id" }, given_id] },
      vars: {},
    },
    dataset_id: "Chronos_Combined",
    slice_type: "gene",
  } as unknown) as DataExplorerPlotConfigDimension);

describe("dimensionToSliceQuery", () => {
  test("collapses a real raw_slice context (SOX10/SOX11 example) into a SliceQuery", () => {
    expect(
      dimensionToSliceQuery(geneDimension("SOX10", "6663"), "depmap_model")
    ).toEqual({
      dataset_id: "Chronos_Combined",
      identifier: "6663",
      identifier_type: "feature_id",
    });
  });

  test("uses sample_id when the context's dimension_type matches the plot's own index_type", () => {
    const dimension = ({
      axis_type: "raw_slice",
      aggregation: "first",
      context: {
        dimension_type: "depmap_model",
        name: "ACH-000001",
        expr: { "==": [{ var: "given_id" }, "ACH-000001"] },
        vars: {},
      },
      dataset_id: "Chronos_Combined",
      slice_type: "depmap_model",
    } as unknown) as DataExplorerPlotConfigDimension;

    expect(dimensionToSliceQuery(dimension, "depmap_model")).toEqual({
      dataset_id: "Chronos_Combined",
      identifier: "ACH-000001",
      identifier_type: "sample_id",
    });
  });

  test("returns null for an aggregated_slice — there is no SliceQuery for 'the mean of a context'", () => {
    const dimension = ({
      axis_type: "aggregated_slice",
      aggregation: "mean",
      context: {
        dimension_type: "gene",
        name: "Some context",
        expr: true,
        vars: {},
      },
      dataset_id: "Chronos_Combined",
      slice_type: "gene",
    } as unknown) as DataExplorerPlotConfigDimension;

    expect(dimensionToSliceQuery(dimension, "depmap_model")).toBeNull();
  });

  test("returns null when there's no dimension at all", () => {
    expect(dimensionToSliceQuery(undefined, "depmap_model")).toBeNull();
  });
});

describe("buildTableConfig", () => {
  const plotConfig = ({
    plot_type: "scatter",
    index_type: "depmap_model",
    dimensions: {
      x: geneDimension("SOX10", "6663"),
      y: geneDimension("SOX11", "6664"),
    },
  } as unknown) as DataExplorerPlotConfig;

  const data = ({
    index_type: "depmap_model",
    index_ids: ["ACH-1", "ACH-2", "ACH-3"],
    index_labels: ["Line 1", "Line 2", "Line 3"],
    dimensions: {
      x: {
        axis_label: "SOX10",
        dataset_id: "Chronos_Combined",
        dataset_label: "CRISPR (DepMap Public 24Q2+Score, Chronos)",
        slice_type: "gene",
        values: [0.1, -0.2, 0.3],
        value_type: "continuous",
        units: "unitless",
      },
      y: {
        axis_label: "SOX11",
        dataset_id: "Chronos_Combined",
        dataset_label: "CRISPR (DepMap Public 24Q2+Score, Chronos)",
        slice_type: "gene",
        values: [0.4, -0.5, 0.6],
        value_type: "continuous",
        units: "unitless",
      },
    },
    filters: {
      visible: { name: "Filtered", values: [true, false, true] },
    },
    metadata: {},
  } as unknown) as DataExplorerPlotResponse;

  test("both raw_slice axes become real slices, not CustomColumns", () => {
    const { initialSlices, customColumns } = buildTableConfig(data, plotConfig);

    expect(initialSlices).toEqual([
      {
        dataset_id: "Chronos_Combined",
        identifier: "6663",
        identifier_type: "feature_id",
      },
      {
        dataset_id: "Chronos_Combined",
        identifier: "6664",
        identifier_type: "feature_id",
      },
    ]);
    expect(customColumns).toHaveLength(0);
  });

  test("rowIds is scoped to only the currently-visible points", () => {
    const { rowIds } = buildTableConfig(data, plotConfig);

    expect(rowIds).toEqual(new Set(["ACH-1", "ACH-3"]));
  });

  test("an aggregated_slice axis falls back to a CustomColumn carrying the plot's own values", () => {
    const aggregatedConfig = ({
      ...plotConfig,
      dimensions: {
        ...plotConfig.dimensions,
        y: {
          axis_type: "aggregated_slice",
          aggregation: "mean",
          context: {
            dimension_type: "gene",
            name: "ctx",
            expr: true,
            vars: {},
          },
          dataset_id: "Chronos_Combined",
          slice_type: "gene",
        },
      },
    } as unknown) as DataExplorerPlotConfig;

    const { initialSlices, customColumns } = buildTableConfig(
      data,
      aggregatedConfig
    );

    expect(initialSlices).toHaveLength(1); // x only
    expect(customColumns).toHaveLength(1); // y falls back

    const yColumn = customColumns[0];
    expect(yColumn.accessorFn?.({ id: "ACH-2" })).toBe(-0.5);
  });

  // Regression test: a plot expanded by a set of compounds fans each model
  // out to one (model, compound) pair per compound. The x axis's values are
  // per-pair (a different viability per compound), so the CSV should carry
  // one column per compound rather than one column whose id→index lookup
  // collapses onto whichever pair happened to be indexed last.
  test("an expanded axis becomes one CustomColumn per expansion member", () => {
    const expandedConfig = ({
      plot_type: "density_1d",
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          aggregation: "expansion",
          context: {
            dimension_type: "compound_v2",
            name: "BRAF inhibitors",
            expr: true,
            vars: {},
          },
          dataset_id: "Rep_all_single_pt_per_compound",
          slice_type: "compound_v2",
        },
      },
      expand_by: [
        {
          slice_type: "compound_v2",
          context: {
            dimension_type: "compound_v2",
            name: "BRAF inhibitors",
            expr: true,
            vars: {},
          },
        },
      ],
    } as unknown) as DataExplorerPlotConfig;

    // Two models × two compounds, index-major (model repeats, compound
    // cycles), matching fetchExpandedPlot's layout.
    const expandedData = ({
      index_type: "depmap_model",
      index_ids: ["ACH-1", "ACH-1", "ACH-2", "ACH-2"],
      index_labels: ["Line 1", "Line 1", "Line 2", "Line 2"],
      dimensions: {
        x: {
          axis_label: "Drug screen (log2 fold change)",
          dataset_id: "Rep_all_single_pt_per_compound",
          dataset_label: "PRISM Repurposing Primary (Viability)",
          slice_type: "compound_v2",
          values: [0.1, 0.2, -0.3, null],
          value_type: "continuous",
          units: "unitless",
        },
      },
      filters: {},
      metadata: {
        Lineage: {
          label: "Lineage",
          values: ["Skin", "Skin", "Lung", "Lung"],
          value_type: "categorical",
        },
      },
      expansions: [
        {
          slice_type: "compound_v2",
          ids: ["cpd-A", "cpd-B", "cpd-A", "cpd-B"],
          labels: ["Compound A", "Compound B", "Compound A", "Compound B"],
        },
      ],
    } as unknown) as DataExplorerPlotResponse;

    const { customColumns } = buildTableConfig(expandedData, expandedConfig);

    const xColumns = customColumns.filter((c) =>
      c.csvHeader.startsWith("Drug screen")
    );
    expect(xColumns.map((c) => c.csvHeader)).toEqual([
      "Drug screen (log2 fold change) PRISM Repurposing Primary (Viability) — Compound A",
      "Drug screen (log2 fold change) PRISM Repurposing Primary (Viability) — Compound B",
    ]);
    expect(xColumns[0].accessorFn?.({ id: "ACH-1" })).toBe(0.1);
    expect(xColumns[1].accessorFn?.({ id: "ACH-1" })).toBe(0.2);
    expect(xColumns[0].accessorFn?.({ id: "ACH-2" })).toBe(-0.3);
    expect(xColumns[1].accessorFn?.({ id: "ACH-2" })).toBeNull();

    // Broadcast metadata (same value for every member of a given model)
    // stays a single column instead of being needlessly repeated.
    const lineageColumns = customColumns.filter(
      (c) => c.csvHeader === "Lineage"
    );
    expect(lineageColumns).toHaveLength(1);
    expect(lineageColumns[0].accessorFn?.({ id: "ACH-2" })).toBe("Lung");
  });

  // Regression test: a member the context named but the selected dataset
  // never measured for any visible row (e.g. a compound never screened
  // against PRISM) shouldn't get a column at all — a column that's blank
  // for every row is worse than no column.
  test("drops an expansion member's column when the dataset has no data for it", () => {
    const expandedConfig = ({
      plot_type: "density_1d",
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          aggregation: "expansion",
          context: {
            dimension_type: "compound_v2",
            name: "BRAF inhibitors",
            expr: true,
            vars: {},
          },
          dataset_id: "Rep_all_single_pt_per_compound",
          slice_type: "compound_v2",
        },
      },
      expand_by: [
        {
          slice_type: "compound_v2",
          context: {
            dimension_type: "compound_v2",
            name: "BRAF inhibitors",
            expr: true,
            vars: {},
          },
        },
      ],
    } as unknown) as DataExplorerPlotConfig;

    // Compound C has a slot in every block but no value anywhere in the
    // dataset (unlike Compound B, which is missing for ACH-2 only).
    const expandedData = ({
      index_type: "depmap_model",
      index_ids: ["ACH-1", "ACH-1", "ACH-1", "ACH-2", "ACH-2", "ACH-2"],
      index_labels: [
        "Line 1",
        "Line 1",
        "Line 1",
        "Line 2",
        "Line 2",
        "Line 2",
      ],
      dimensions: {
        x: {
          axis_label: "Drug screen (log2 fold change)",
          dataset_id: "Rep_all_single_pt_per_compound",
          dataset_label: "PRISM Repurposing Primary (Viability)",
          slice_type: "compound_v2",
          values: [0.1, 0.2, null, -0.3, null, null],
          value_type: "continuous",
          units: "unitless",
        },
      },
      filters: {},
      metadata: {},
      expansions: [
        {
          slice_type: "compound_v2",
          ids: ["cpd-A", "cpd-B", "cpd-C", "cpd-A", "cpd-B", "cpd-C"],
          labels: [
            "Compound A",
            "Compound B",
            "Compound C",
            "Compound A",
            "Compound B",
            "Compound C",
          ],
        },
      ],
    } as unknown) as DataExplorerPlotResponse;

    const { customColumns } = buildTableConfig(expandedData, expandedConfig);

    expect(customColumns.map((c) => c.csvHeader)).toEqual([
      "Drug screen (log2 fold change) PRISM Repurposing Primary (Viability) — Compound A",
      "Drug screen (log2 fold change) PRISM Repurposing Primary (Viability) — Compound B",
    ]);
  });
});
