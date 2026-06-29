import { PartialDataExplorerPlotConfig } from "@depmap/types";
import plotConfigReducer, {
  PlotConfigReducerAction,
} from "../plotConfigReducer";

describe("plotConfigReducer", () => {
  it("should preserve 'x' when switching to Density 1D plot type", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      dimensions: {
        x: {},
        y: {},
      },
    };

    const action: PlotConfigReducerAction = {
      type: "select_plot_type",
      payload: "density_1d",
    };

    const nextPlot = plotConfigReducer(plot, action);

    expect(nextPlot.dimensions!.x).toBeDefined();
    expect(nextPlot.dimensions!.y).not.toBeDefined();
  });

  it("should clear the context selection if is set to 'All' with a correlation heatmap", () => {
    const plot = {
      plot_type: "density_1d" as const,
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "mean" as const,
          context: {
            name: "All",
            dimension_type: "gene",
            expr: true,
            vars: {},
          },
          dataset_id: "Chronos_Combined",
          slice_type: "gene",
        },
      },
    };

    const action: PlotConfigReducerAction = {
      type: "select_plot_type",
      payload: "correlation_heatmap",
    };

    const nextPlot = plotConfigReducer(plot, action);
    expect(nextPlot.dimensions?.x?.context).not.toBeDefined();
  });

  it("should always set `aggregation` to 'correlation' when switching to a correlation heatmap", () => {
    const plot = {
      plot_type: "density_1d" as const,
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "mean" as const,
          dataset_id: "Chronos_Combined",
          slice_type: "gene",
          context: {
            dimension_type: "gene",
            expr: {
              in: [{ var: "entity_label" }, ["DNA2", "RPL13A", "RPL34"]],
            },
            vars: {
              entitiy_label: {
                dataset_id: "gene_metadata",
                identifier_type: "column" as const,
                identifier: "label",
              },
            },
            name: "abc",
          } as any,
        },
      },
    };

    const nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "correlation_heatmap",
    });

    expect(nextPlot.dimensions?.x?.aggregation).toBe("correlation");
  });

  it("should never have `aggregation` set to 'correlation' unless the plot_type is 'correlation_heatmap'", () => {
    const plot = {
      plot_type: "correlation_heatmap" as const,
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "correlation" as const,
          dataset_id: "Chronos_Combined",
          slice_type: "gene",
          context: {
            name: "test",
            dimension_type: "gene",
            expr: {
              in: [{ var: "entity_label" }, ["DNA2", "RPL13A", "RPL34"]],
            },
            vars: {
              entitiy_label: {
                dataset_id: "gene_metadata",
                identifier_type: "column" as const,
                identifier: "label",
              },
            },
          } as any,
        },
      },
    };

    let nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "density_1d",
    });
    expect(nextPlot.dimensions?.x?.aggregation).not.toBe("correlation");

    nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "scatter",
    });
    expect(nextPlot.dimensions?.x?.aggregation).not.toBe("correlation");

    nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "waterfall",
    });
    expect(nextPlot.dimensions?.x?.aggregation).not.toBe("correlation");
  });

  it("installs group_by 'expansion' as a one-time default on the expand_by enable transition, overwriting any prior group_by", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      // A prior grouping that entering expansion mode should overwrite.
      group_by: "property" as const,
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "mean" as const,
          dataset_id: "gene_expr",
          slice_type: "gene",
          context: { name: "x", dimension_type: "gene", expr: true, vars: {} },
        },
        y: {},
      },
    };

    const nextPlot = plotConfigReducer(plot, {
      type: "select_expansion",
      payload: {
        key: "x",
        expand_by: {
          slice_type: "transcript",
          context: {
            name: "T",
            dimension_type: "transcript",
            expr: true,
            vars: {},
          } as any,
          dataset_id: "transcript_expr",
        },
      },
    });

    expect(nextPlot.group_by).toBe("expansion");
    expect(nextPlot.expand_by?.length).toBe(1);
    expect(nextPlot.dimensions?.x?.aggregation).toBe("expansion");
  });

  it("does not re-install group_by 'expansion' on a subsequent select_expansion while already expanded", () => {
    // Already expanded; the user has since moved group_by off the default
    // (here stood in for by "property"). A paging dispatch must not clobber it.
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      group_by: "property" as const,
      expand_by: [
        { slice_type: "transcript", context: {} as any, limit: 9, offset: 0 },
      ],
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "expansion" as const,
          dataset_id: "transcript_expr",
          slice_type: "transcript",
          context: {} as any,
        },
        y: {},
      },
    };

    const nextPlot = plotConfigReducer(plot, {
      type: "select_expansion",
      payload: {
        key: "x",
        expand_by: {
          slice_type: "transcript",
          context: {} as any,
          dataset_id: "transcript_expr",
          offset: 9,
        },
      },
    });

    expect(nextPlot.group_by).toBe("property");
  });

  it("resets group_by to undefined when clearing an expansion grouped by 'expansion'", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      group_by: "expansion" as const,
      expand_by: [
        { slice_type: "transcript", context: {} as any, limit: 9, offset: 0 },
      ],
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "expansion" as const,
          dataset_id: "transcript_expr",
          slice_type: "transcript",
          context: {} as any,
        },
        y: {},
      },
    };

    const nextPlot = plotConfigReducer(plot, {
      type: "select_expansion",
      payload: { key: "x", expand_by: null },
    });

    expect(nextPlot.group_by).toBeUndefined();
    // normalize() strips the now-empty expand_by once the sentinel is gone.
    expect(nextPlot.expand_by).toBeUndefined();
    expect(nextPlot.dimensions?.x?.aggregation).toBe("mean");
  });

  it("preserves a non-'expansion' group_by when clearing an expansion", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      group_by: "property" as const,
      expand_by: [
        { slice_type: "transcript", context: {} as any, limit: 9, offset: 0 },
      ],
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "expansion" as const,
          dataset_id: "transcript_expr",
          slice_type: "transcript",
          context: {} as any,
        },
        y: {},
      },
    };

    const nextPlot = plotConfigReducer(plot, {
      type: "select_expansion",
      payload: { key: "x", expand_by: null },
    });

    expect(nextPlot.group_by).toBe("property");
  });
});
