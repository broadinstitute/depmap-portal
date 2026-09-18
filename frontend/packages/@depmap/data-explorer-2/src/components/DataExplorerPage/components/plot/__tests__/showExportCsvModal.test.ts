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
});
