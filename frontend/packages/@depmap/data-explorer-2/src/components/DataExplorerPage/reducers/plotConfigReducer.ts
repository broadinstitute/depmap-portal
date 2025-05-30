import omit from "lodash.omit";
import {
  DataExplorerContext,
  DataExplorerPlotConfig,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotType,
  DimensionKey,
  FilterKey,
  PartialDataExplorerPlotConfig,
  SliceQuery,
} from "@depmap/types";

export type PlotConfigReducerAction =
  | { type: "set_plot"; payload: object | ((p: object) => object) }
  | { type: "select_plot_type"; payload: DataExplorerPlotType }
  | { type: "select_index_type"; payload: string }
  | {
      type: "select_dimension";
      payload: {
        key: DimensionKey;
        dimension: Partial<DataExplorerPlotConfigDimension>;
      };
    }
  | {
      type: "select_filter";
      payload: {
        key: FilterKey;
        filter: DataExplorerContext | null;
      };
    }
  | { type: "select_color_by"; payload: DataExplorerPlotConfig["color_by"] }
  | { type: "select_sort_by"; payload: DataExplorerPlotConfig["sort_by"] }
  | {
      type: "select_color_property";
      payload: SliceQuery | null;
    }
  | {
      type: "select_legacy_color_property";
      payload: { slice_id: string | null };
    }
  | { type: "select_hide_points"; payload: boolean }
  | { type: "select_hide_identity_line"; payload: boolean }
  | { type: "select_use_clustering"; payload: boolean }
  | { type: "select_show_regression_line"; payload: boolean }
  | {
      type: "select_scatter_y_slice";
      payload: {
        dataset_id: string;
        slice_label: string;
        slice_type: string;
        // `given_id` is optional to work with the legacy Portal as the backend.
        // With Breadbox-as-the-backend (currently only supported in Elrara),
        // given_id is required.
        given_id?: string;
      };
    };

const DEFAULT_SORT = "alphabetical";

const isEmptyObject = (obj?: object) =>
  obj !== null && typeof obj === "object" && Object.keys(obj).length === 0;

// Strips out any optional fields that are empty objects or `false` options.
const normalize = (plot: PartialDataExplorerPlotConfig) => {
  let nextPlot = plot;

  if (isEmptyObject(plot.filters)) {
    nextPlot = omit(nextPlot, "filters");
  }

  if (isEmptyObject(plot.metadata)) {
    nextPlot = omit(nextPlot, "metadata");
  }

  if (plot.hide_points === false || plot.plot_type !== "density_1d") {
    nextPlot = omit(nextPlot, "hide_points");
  }

  if (plot.hide_identity_line === false || plot.plot_type !== "scatter") {
    nextPlot = omit(nextPlot, "hide_identity_line");
  }

  if (plot.show_regression_line === false || plot.plot_type !== "scatter") {
    nextPlot = omit(nextPlot, "show_regression_line");
  }

  if (
    plot.use_clustering === false ||
    plot.plot_type !== "correlation_heatmap"
  ) {
    nextPlot = omit(nextPlot, "use_clustering");
  }

  if (plot.plot_type !== "density_1d" && plot.plot_type !== "waterfall") {
    nextPlot = omit(nextPlot, "sort_by");
  }

  return nextPlot;
};

function plotConfigReducer(
  plot: PartialDataExplorerPlotConfig,
  action: PlotConfigReducerAction
) {
  switch (action.type) {
    // HACK: "set_plot" is used in cases where we want to completely replace
    // the plot with something known to be valid. Some examples include:
    //
    // - Loading a plot from a URL
    // - Using "visualize selected" to derive a related plot
    // - Replacing an existing context with an edited one
    //
    // It seems we could use a "select_context" action for that last one,
    // though 🤔
    case "set_plot":
      return typeof action.payload === "function"
        ? action.payload(plot)
        : action.payload;

    case "select_plot_type": {
      const nextPlotType = action.payload;

      if (!plot.dimensions?.x) {
        return {
          ...plot,
          plot_type: nextPlotType,
        };
      }

      let dx = plot.dimensions.x;

      // These selections are incompatible. Take the nuclear option and wipe
      // everything.
      if (nextPlotType === "scatter" && plot.index_type === "other") {
        return {
          plot_type: nextPlotType,
          dimensions: { x: {}, y: {} },
        };
      }

      if (
        nextPlotType !== "correlation_heatmap" &&
        dx.aggregation === "correlation"
      ) {
        dx = {
          ...dx,
          aggregation: dx.axis_type === "raw_slice" ? "first" : "mean",
        };
      }

      if (nextPlotType === "correlation_heatmap") {
        if (dx.axis_type !== "aggregated_slice" && dx.context) {
          dx = omit(dx, "context");
        }

        // Edge case: Other plot types allow you to select the special value
        // "All" as a context. The correlation_heatmap does not. We can detect
        // this case by looking at the `expr`. It is set to a boolean value of
        // `true` only for this special case.
        if (dx.context && dx.context.expr === true) {
          dx = omit(dx, "context");
        }

        dx = {
          ...dx,
          axis_type: "aggregated_slice",
          aggregation: "correlation",
        };
      }

      let nextPlot: PartialDataExplorerPlotConfig = {
        ...plot,
        plot_type: nextPlotType,
        dimensions: {
          x: dx,
          ...(nextPlotType === "scatter" ? { y: {} } : {}),
        },
      };

      if (
        plot.plot_type === "correlation_heatmap" &&
        nextPlotType !== "correlation_heatmap"
      ) {
        nextPlot = omit(nextPlot, ["filters"]);
      }

      if (nextPlotType === "correlation_heatmap") {
        nextPlot = omit(nextPlot, [
          "color_by",
          "sort_by",
          "filters",
          "metadata",
        ]);

        // No support for custom data yet (there's no such thing as a "custom
        // context").
        if (dx.slice_type === "custom") {
          nextPlot.dimensions!.x = omit(dx, "slice_type");
        }
      } else if (plot.dimensions?.color) {
        nextPlot.dimensions!.color = plot.dimensions.color;
      }

      if (nextPlotType === "scatter" && plot.index_type !== "depmap_model") {
        nextPlot.dimensions!.y = {
          slice_type: "depmap_model",
          axis_type: "raw_slice",
        };
      }

      // Scenario: a scatter with a "color by" property is switched to a 1D
      // plot.
      // How to handle: Preserve that selection and introduce a default sort.
      if (
        ["density_1d", "waterfall"].includes(nextPlotType) &&
        plot.metadata?.color_property &&
        !nextPlot.sort_by
      ) {
        nextPlot.sort_by = DEFAULT_SORT;
      }

      return normalize(nextPlot);
    }

    case "select_index_type": {
      const index_type = action.payload;

      if (index_type === plot.index_type) {
        return plot;
      }

      const nextPlot = omit(
        {
          ...plot,
          index_type,
          dimensions:
            plot.plot_type === "scatter" ? { x: {}, y: {} } : { x: {} },
        },
        ["color_by", "filters", "metadata"]
      );

      Object.keys(nextPlot.dimensions).forEach((key) => {
        nextPlot.dimensions[key as "x" | "y"] = {
          axis_type:
            plot.plot_type === "correlation_heatmap"
              ? "aggregated_slice"
              : "raw_slice",
        };
      });

      return nextPlot;
    }

    case "select_dimension": {
      const { key, dimension } = action.payload;

      return {
        ...plot,
        dimensions: {
          ...plot.dimensions,
          [key]: dimension,
        },
      };
    }

    case "select_filter": {
      const { key, filter } = action.payload;

      const filters = { ...plot.filters };

      if (filter === null) {
        delete filters[key];
      } else {
        filters[key] = filter;
      }

      return normalize({ ...plot, filters });
    }

    case "select_color_by": {
      let dimensions;

      if (action.payload === "custom") {
        dimensions = {
          ...plot.dimensions,
          color: {},
        };
      } else {
        dimensions = omit(plot.dimensions, "color");
      }

      const visibleFilter = plot.filters?.visible;

      return normalize({
        ...plot,
        color_by: action.payload,
        sort_by: DEFAULT_SORT,
        dimensions,
        filters: visibleFilter ? { visible: visibleFilter } : {},
        metadata: {},
      });
    }

    case "select_sort_by": {
      return normalize({
        ...plot,
        sort_by: action.payload,
      });
    }

    case "select_color_property": {
      const sliceQuery = action.payload;

      if (sliceQuery === null) {
        return normalize({
          ...plot,
          metadata: omit(plot.metadata, "color_property"),
        });
      }

      return {
        ...plot,
        metadata: {
          ...plot.metadata,
          color_property: sliceQuery,
        },
      };
    }

    // legacy version used a slice ID instead of SliceQuery
    case "select_legacy_color_property": {
      const { slice_id } = action.payload;

      if (slice_id === null) {
        return normalize({
          ...plot,
          metadata: omit(plot.metadata, "color_property"),
        });
      }

      return {
        ...plot,
        metadata: {
          ...plot.metadata,
          color_property: {
            slice_id,
          },
        },
      };
    }

    case "select_hide_points": {
      if (plot.plot_type !== "density_1d") {
        window.console.warn(
          "`hide_points` is only supported by the 'density_1d' plot type."
        );
      }

      return normalize({
        ...plot,
        hide_points: action.payload,
      });
    }

    case "select_hide_identity_line": {
      if (plot.plot_type !== "scatter") {
        window.console.warn(
          "`hide_identity_line` is only supported by the 'scatter' plot type."
        );
      }

      return normalize({
        ...plot,
        hide_identity_line: action.payload,
      });
    }

    case "select_use_clustering": {
      if (plot.plot_type !== "correlation_heatmap") {
        window.console.warn(
          "`use_clustering` is only supported by the 'correlation_heatmap' plot type."
        );
      }

      return normalize({
        ...plot,
        use_clustering: action.payload,
      });
    }

    case "select_show_regression_line": {
      if (plot.plot_type !== "scatter") {
        window.console.warn(
          "`show_regression_line` is only supported by the 'scatter' plot type."
        );
      }

      return normalize({
        ...plot,
        show_regression_line: action.payload,
      });
    }

    case "select_scatter_y_slice": {
      const { dataset_id, slice_label, slice_type, given_id } = action.payload;

      return {
        ...plot,
        plot_type: "scatter",
        dimensions: {
          ...plot.dimensions,
          y: {
            axis_type: "raw_slice",
            aggregation: "first",
            slice_type,
            dataset_id,
            context: {
              name: slice_label,
              [given_id ? "dimension_type" : "context_type"]: slice_type,
              expr: given_id
                ? { "==": [{ var: "given_id" }, given_id] }
                : { "==": [{ var: "entity_label" }, slice_label] },
            },
          },
        },
      };
    }

    default:
      throw new Error(`Unknown action: "${(action as { type: string }).type}"`);
  }
}

export default plotConfigReducer;
