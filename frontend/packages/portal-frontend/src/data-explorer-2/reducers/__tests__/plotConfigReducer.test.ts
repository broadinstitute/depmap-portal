import { PartialDataExplorerPlotConfig } from "@depmap/types";
import plotConfigReducer, {
  PlotConfigReducerAction,
} from "src/data-explorer-2/reducers/plotConfigReducer";

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

    expect(nextPlot.dimensions.x).toBeDefined();
    expect(nextPlot.dimensions.y).not.toBeDefined();
  });

  it("should clear the context selection if is set to 'All' with a correlation heatmap", () => {
    const plot = {
      plot_type: "density_1d",
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          aggregation: "mean",
          context: {
            name: "All",
            context_type: "gene",
            expr: true,
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
    expect(nextPlot.dimensions.x.context).not.toBeDefined();
  });

  it("should always set `aggregation` to 'correlation' when switching to a correlation heatmap", () => {
    const plot = {
      plot_type: "density_1d",
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          aggregation: "mean",
          dataset_id: "Chronos_Combined",
          slice_type: "gene",
          context: {
            context_type: "gene",
            expr: {
              in: [{ var: "entity_label" }, ["DNA2", "RPL13A", "RPL34"]],
            },
            name: "abc",
          },
        },
      },
    };

    const nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "correlation_heatmap",
    });

    expect(nextPlot.dimensions.x.aggregation).toBe("correlation");
  });

  it("should never have `aggregation` set to 'correlation' unless the plot_type is 'correlation_heatmap'", () => {
    const plot = {
      plot_type: "correlation_heatmap",
      index_type: "depmap_model",
      dimensions: {
        x: {
          axis_type: "aggregated_slice",
          aggregation: "correlation",
          dataset_id: "Chronos_Combined",
          slice_type: "gene",
          context: {
            name: "test",
            context_type: "gene",
            expr: {
              in: [{ var: "entity_label" }, ["DNA2", "RPL13A", "RPL34"]],
            },
          },
        },
      },
    };

    let nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "density_1d",
    });
    expect(nextPlot.dimensions.x.aggregation).not.toBe("correlation");

    nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "scatter",
    });
    expect(nextPlot.dimensions.x.aggregation).not.toBe("correlation");

    nextPlot = plotConfigReducer(plot, {
      type: "select_plot_type",
      payload: "waterfall",
    });
    expect(nextPlot.dimensions.x.aggregation).not.toBe("correlation");
  });
});
