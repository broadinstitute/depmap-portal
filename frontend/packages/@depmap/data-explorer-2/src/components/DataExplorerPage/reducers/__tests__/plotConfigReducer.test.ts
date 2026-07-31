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

  it("installs facet_by 'expansion' as a one-time default on the expand_by enable transition, overwriting any prior facet_by", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      // A prior faceting that entering expansion mode should overwrite.
      facet_by: "property" as const,
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

    expect(nextPlot.facet_by).toBe("expansion");
    expect(nextPlot.expand_by?.length).toBe(1);
    expect(nextPlot.dimensions?.x?.aggregation).toBe("expansion");
  });

  it("does not re-install facet_by 'expansion' on a subsequent select_expansion while already expanded", () => {
    // Already expanded; the user has since moved facet_by off the default
    // (here stood in for by "property"). A paging dispatch must not clobber it.
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      facet_by: "property" as const,
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

    expect(nextPlot.facet_by).toBe("property");
  });

  it("resets facet_by to undefined when clearing an expansion faceted by 'expansion'", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      facet_by: "expansion" as const,
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

    expect(nextPlot.facet_by).toBeUndefined();
    // normalize() strips the now-empty expand_by once the sentinel is gone.
    expect(nextPlot.expand_by).toBeUndefined();
    expect(nextPlot.dimensions?.x?.aggregation).toBe("mean");
  });

  it("preserves a non-'expansion' facet_by when clearing an expansion", () => {
    const plot = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      facet_by: "property" as const,
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

    expect(nextPlot.facet_by).toBe("property");
  });

  describe("color_by/facet_by independence", () => {
    it("select_color_by preserves facet_by's own filters/metadata/dimensions", () => {
      const plot = {
        plot_type: "scatter" as const,
        index_type: "depmap_model",
        color_by: "property" as const,
        facet_by: "raw_slice" as const,
        dimensions: {
          x: {},
          facet: { axis_type: "raw_slice" as const, slice_type: "gene" } as any,
        },
        filters: {
          facet1: { name: "Facet 1" } as any,
          facet2: { name: "Facet 2" } as any,
        },
        metadata: {
          color_property: { dataset_id: "color-dataset" } as any,
          facet_property: { dataset_id: "facet-dataset" } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_color_by",
        payload: "aggregated_slice",
      });

      expect(nextPlot.facet_by).toBe("raw_slice");
      expect(nextPlot.dimensions?.facet).toEqual(plot.dimensions.facet);
      expect(nextPlot.filters?.facet1).toEqual(plot.filters.facet1);
      expect(nextPlot.filters?.facet2).toEqual(plot.filters.facet2);
      expect(nextPlot.metadata?.facet_property).toEqual(
        plot.metadata.facet_property
      );
      // Color's own state is still reset, as before.
      expect(nextPlot.metadata?.color_property).toBeUndefined();
    });

    it("select_facet_by preserves color_by's own filters/metadata/dimensions", () => {
      const plot = {
        plot_type: "scatter" as const,
        index_type: "depmap_model",
        color_by: "raw_slice" as const,
        facet_by: "property" as const,
        dimensions: {
          x: {},
          color: { axis_type: "raw_slice" as const, slice_type: "gene" } as any,
        },
        filters: {
          color1: { name: "Color 1" } as any,
          color2: { name: "Color 2" } as any,
        },
        metadata: {
          color_property: { dataset_id: "color-dataset" } as any,
          facet_property: { dataset_id: "facet-dataset" } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_by",
        payload: "custom",
      });

      expect(nextPlot.color_by).toBe("raw_slice");
      expect(nextPlot.dimensions?.color).toEqual(plot.dimensions.color);
      expect(nextPlot.filters?.color1).toEqual(plot.filters.color1);
      expect(nextPlot.filters?.color2).toEqual(plot.filters.color2);
      expect(nextPlot.metadata?.color_property).toEqual(
        plot.metadata.color_property
      );
      // facet_by's own state is reset, mirroring select_color_by.
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
    });

    it("select_facet_by resets its own filters/metadata when the mode changes, mirroring select_color_by", () => {
      const plot = {
        plot_type: "scatter" as const,
        index_type: "depmap_model",
        facet_by: "raw_slice" as const,
        dimensions: { x: {} },
        filters: {
          facet1: { name: "Facet 1" } as any,
          facet2: { name: "Facet 2" } as any,
        },
        metadata: {
          facet_property: { dataset_id: "facet-dataset" } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_by",
        payload: "property",
      });

      expect(nextPlot.filters?.facet1).toBeUndefined();
      expect(nextPlot.filters?.facet2).toBeUndefined();
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
    });

    it("select_facet_by seeds dimensions.facet only for 'custom' and clears it otherwise", () => {
      const plot = {
        plot_type: "scatter" as const,
        index_type: "depmap_model",
        facet_by: "raw_slice" as const,
        dimensions: {
          x: {},
          facet: { axis_type: "raw_slice" as const, slice_type: "gene" } as any,
        },
      };

      const toCustom = plotConfigReducer(plot, {
        type: "select_facet_by",
        payload: "custom",
      });
      expect(toCustom.dimensions?.facet).toEqual({});

      const toProperty = plotConfigReducer(plot, {
        type: "select_facet_by",
        payload: "property",
      });
      expect(toProperty.dimensions?.facet).toBeUndefined();
    });

    it("clearing facet_by also clears dimensions.facet", () => {
      const plot = {
        plot_type: "scatter" as const,
        index_type: "depmap_model",
        facet_by: "custom" as const,
        dimensions: {
          x: {},
          facet: { axis_type: "raw_slice" as const, slice_type: "gene" } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_by",
        payload: null,
      });

      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.dimensions?.facet).toBeUndefined();
    });
  });

  // Regression: select_plot_type rebuilds `dimensions` from just x/y and
  // only ever restored dimensions.color afterward — dimensions.facet had no
  // equivalent restoration, so facet_by: "custom" survived as a field but
  // its backing vanished, breaking faceting immediately (not just on
  // reload/normalize). facet_by must be treated exactly as color_by is
  // everywhere in this action.
  describe("facet_by survives plot_type changes, mirroring color_by", () => {
    const xDimension = {
      axis_type: "raw_slice" as const,
      aggregation: "first" as const,
      slice_type: "gene",
      dataset_id: "Chronos_Combined",
      context: {
        name: "FABP5",
        dimension_type: "gene",
        expr: { "==": [{ var: "entity_label" }, "FABP5"] },
        vars: {},
      },
    };

    it("preserves dimensions.facet across a non-heatmap plot_type change ('custom' mode)", () => {
      const plot = {
        plot_type: "density_1d" as const,
        index_type: "depmap_model",
        facet_by: "custom" as const,
        dimensions: {
          x: xDimension,
          facet: { ...xDimension, context: { ...xDimension.context, name: "SOX2" } },
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_plot_type",
        payload: "waterfall",
      });

      expect(nextPlot.facet_by).toBe("custom");
      expect(nextPlot.dimensions?.facet).toEqual(plot.dimensions.facet);
    });

    it("drops facet_by and its backing when switching to correlation_heatmap, mirroring color_by", () => {
      const plot = {
        plot_type: "density_1d" as const,
        index_type: "depmap_model",
        color_by: "custom" as const,
        facet_by: "custom" as const,
        dimensions: {
          x: xDimension,
          color: { ...xDimension, context: { ...xDimension.context, name: "BDNF" } },
          facet: { ...xDimension, context: { ...xDimension.context, name: "SOX2" } },
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_plot_type",
        payload: "correlation_heatmap",
      });

      expect(nextPlot.color_by).toBeUndefined();
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.dimensions?.color).toBeUndefined();
      expect(nextPlot.dimensions?.facet).toBeUndefined();
    });

    it("drops facet_by and its backing on select_index_type, mirroring color_by", () => {
      const plot = {
        plot_type: "density_1d" as const,
        index_type: "depmap_model",
        color_by: "raw_slice" as const,
        facet_by: "raw_slice" as const,
        dimensions: { x: xDimension },
        filters: {
          color1: { name: "Color A" } as any,
          facet1: { name: "Facet A" } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_index_type",
        payload: "gene",
      });

      expect(nextPlot.color_by).toBeUndefined();
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.filters?.color1).toBeUndefined();
      expect(nextPlot.filters?.facet1).toBeUndefined();
    });
  });

  // canSwapColorAndFacet (utils.ts) gates this action to three cases: a full
  // swap when both axes hold one of the five real, shared values and are
  // complete; a "promote" when facet_by is unset; and a "demote" when
  // color_by defers to facet_by (via "facet" or by being absent — the two
  // are semantically identical) or holds an incomplete real selection.
  // color_by: "uniform" has no facet_by equivalent and stays a genuine
  // no-op, since it's a deliberate, complete choice, not a deferred one.
  describe("swap_color_and_facet", () => {
    const basePlot = {
      // density_1d (not scatter): sort_by only survives normalize() for
      // density_1d/waterfall plot types (unrelated to this action) — picked
      // so the "sort_by untouched" test below actually exercises something.
      plot_type: "density_1d" as const,
      index_type: "depmap_model",
      sort_by: "alphabetical" as const,
      color_by: "raw_slice" as const,
      facet_by: "property" as const,
      dimensions: {
        x: {},
        facet: { axis_type: "raw_slice" as const, slice_type: "gene" } as any,
      },
      filters: {
        visible: { name: "Visible" } as any,
        color1: { name: "Color 1" } as any,
        color2: { name: "Color 2" } as any,
      },
      metadata: {
        // A complete SliceQuery — canSwapColorAndFacet's completeness check
        // requires this (unlike other tests in this file, which use
        // incomplete stubs since they don't exercise that check).
        facet_property: {
          dataset_id: "facet-dataset",
          identifier: "lineage",
          identifier_type: "column",
        } as any,
      },
    };

    it("swaps color_by/facet_by and their backing filters/metadata/dimensions", () => {
      const nextPlot = plotConfigReducer(basePlot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.color_by).toBe("property");
      expect(nextPlot.facet_by).toBe("raw_slice");
      expect(nextPlot.metadata?.color_property).toEqual(
        basePlot.metadata.facet_property
      );
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
      expect(nextPlot.filters?.facet1).toEqual(basePlot.filters.color1);
      expect(nextPlot.filters?.facet2).toEqual(basePlot.filters.color2);
      expect(nextPlot.filters?.color1).toBeUndefined();
      expect(nextPlot.filters?.color2).toBeUndefined();
      expect(nextPlot.dimensions?.color).toEqual(basePlot.dimensions.facet);
      expect(nextPlot.dimensions?.facet).toBeUndefined();
    });

    it("leaves filters.visible and sort_by untouched", () => {
      const nextPlot = plotConfigReducer(basePlot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.filters?.visible).toEqual(basePlot.filters.visible);
      expect(nextPlot.sort_by).toBe("alphabetical");
    });

    it("promotes color_by to facet_by when facet_by is absent", () => {
      // No longer a no-op: color_by ("raw_slice", complete via
      // filters.color1/2) is moved over to become facet_by, with color_by
      // rewritten to "facet" so it defers back to it.
      const plot = { ...basePlot, facet_by: undefined };
      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.color_by).toBe("facet");
      expect(nextPlot.facet_by).toBe("raw_slice");
      expect(nextPlot.filters?.facet1).toEqual(basePlot.filters.color1);
      expect(nextPlot.filters?.facet2).toEqual(basePlot.filters.color2);
      expect(nextPlot.filters?.color1).toBeUndefined();
      expect(nextPlot.filters?.color2).toBeUndefined();
      // Stale facet backing (leftover from basePlot's own facet_by:
      // "property"/dimensions.facet fixture) is fully replaced, not merged
      // with — color_by: "raw_slice" has nothing to contribute to either.
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
      expect(nextPlot.dimensions?.facet).toBeUndefined();
    });

    it("demotes facet_by to color_by when color_by is absent", () => {
      // Absent color_by and color_by: "facet" are semantically identical
      // (resolveColorMode treats both as "defer to facet_by"), so this must
      // behave exactly like the "facet" case below, not no-op.
      const plot = { ...basePlot, color_by: undefined };
      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.color_by).toBe("property");
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.metadata?.color_property).toEqual(
        basePlot.metadata.facet_property
      );
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
      expect(nextPlot.dimensions?.color).toEqual(basePlot.dimensions.facet);
      expect(nextPlot.dimensions?.facet).toBeUndefined();
      expect(nextPlot.filters?.color1).toBeUndefined();
      expect(nextPlot.filters?.color2).toBeUndefined();
    });

    it("demotes facet_by to color_by when color_by is 'facet'", () => {
      // No longer a no-op: facet_by ("property", complete via
      // metadata.facet_property) is moved over to become color_by, with
      // facet_by unset entirely.
      const plot = { ...basePlot, color_by: "facet" as const };
      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.color_by).toBe("property");
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.metadata?.color_property).toEqual(
        basePlot.metadata.facet_property
      );
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
      expect(nextPlot.dimensions?.color).toEqual(basePlot.dimensions.facet);
      expect(nextPlot.dimensions?.facet).toBeUndefined();
      // Stale color backing (basePlot's own color_by: "raw_slice" fixture)
      // is fully replaced, not merged with — facet_by: "property" has
      // nothing to contribute to filters.
      expect(nextPlot.filters?.color1).toBeUndefined();
      expect(nextPlot.filters?.color2).toBeUndefined();
    });

    it("no-ops when color_by is 'uniform'", () => {
      const plot = { ...basePlot, color_by: "uniform" as const };
      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot).toBe(plot);
    });

    it("no-ops when facet_by somehow holds 'facet' or 'uniform' (defensive, e.g. a hand-authored link)", () => {
      const plotWithFacet = { ...basePlot, facet_by: "facet" as any };
      expect(
        plotConfigReducer(plotWithFacet, { type: "swap_color_and_facet" })
      ).toBe(plotWithFacet);

      const plotWithUniform = { ...basePlot, facet_by: "uniform" as any };
      expect(
        plotConfigReducer(plotWithUniform, { type: "swap_color_and_facet" })
      ).toBe(plotWithUniform);
    });

    it("demotes facet_by to color_by when color_by's own mode is selected but not yet backed by real data", () => {
      // color_by: "property" picked from the dropdown, but no annotation
      // chosen yet (metadata.color_property is absent) — an in-progress
      // editing state with nothing worth preserving, so facet_by (complete,
      // via basePlot's own metadata.facet_property) is free to move over
      // and take its place — the generalized "demote" case: any incomplete
      // color_by is as safe to discard as the "facet"/absent cases below.
      const plot = {
        ...basePlot,
        color_by: "property" as const,
        // Clear the filters that back the base fixture's "raw_slice" so
        // this exercises color's own (missing) property backing, not stale
        // leftover filters.
        filters: { visible: basePlot.filters.visible },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.color_by).toBe("property");
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.metadata?.color_property).toEqual(
        basePlot.metadata.facet_property
      );
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
      expect(nextPlot.dimensions?.color).toEqual(basePlot.dimensions.facet);
      expect(nextPlot.dimensions?.facet).toBeUndefined();
    });

    it("demotes facet_by to color_by when color_by's own SliceQuery is present but incomplete", () => {
      const plot = {
        ...basePlot,
        color_by: "property" as const,
        filters: { visible: basePlot.filters.visible },
        metadata: {
          ...basePlot.metadata,
          // Missing identifier/identifier_type.
          color_property: { dataset_id: "color-dataset" } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.color_by).toBe("property");
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.metadata?.color_property).toEqual(
        basePlot.metadata.facet_property
      );
      expect(nextPlot.metadata?.facet_property).toBeUndefined();
    });

    it("still no-ops when BOTH color_by and facet_by are incomplete", () => {
      // Neither axis has a real, complete selection — there's nothing on
      // either side worth moving anywhere, so this must remain a no-op.
      const plot = {
        ...basePlot,
        color_by: "property" as const,
        facet_by: "custom" as const,
        filters: { visible: basePlot.filters.visible },
        metadata: {},
        dimensions: { x: basePlot.dimensions.x, facet: {} as any },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot).toBe(plot);
    });

    it("no-ops when facet_by's own mode is selected but not yet backed by real data", () => {
      const plot = {
        ...basePlot,
        facet_by: "custom" as const,
        // Seed dimensions.facet the way the UI would on first picking
        // "Dataset", before any actual dataset/context is chosen.
        dimensions: { x: basePlot.dimensions.x, facet: {} as any },
        metadata: {},
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot).toBe(plot);
    });

    it("no-ops when the two axes already match exactly (same mode, same backing)", () => {
      const plot = {
        ...basePlot,
        color_by: "property" as const,
        facet_by: "property" as const,
        filters: { visible: basePlot.filters.visible },
        metadata: {
          color_property: basePlot.metadata.facet_property,
          facet_property: basePlot.metadata.facet_property,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot).toBe(plot);
    });

    it("does swap when the two axes share a mode but have different backing", () => {
      // Same mode ("property") on both sides, but pointed at different
      // properties — not a match, so the swap should still occur.
      const colorProperty = {
        dataset_id: "color-dataset",
        identifier: "subtype",
        identifier_type: "column",
      };

      const plot = {
        ...basePlot,
        color_by: "property" as const,
        facet_by: "property" as const,
        filters: { visible: basePlot.filters.visible },
        metadata: {
          color_property: colorProperty as any,
          facet_property: basePlot.metadata.facet_property,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "swap_color_and_facet",
      });

      expect(nextPlot.metadata?.color_property).toEqual(
        basePlot.metadata.facet_property
      );
      expect(nextPlot.metadata?.facet_property).toEqual(colorProperty);
    });
  });

  describe("facet_by finalization defaults sort_by", () => {
    const basePlot = {
      plot_type: "density_1d" as const,
      index_type: "depmap_model",
      dimensions: { x: {} },
    };

    it("select_facet_property: sets sort_by the moment facet_by 'property' becomes backed", () => {
      const plot = { ...basePlot, facet_by: "property" as const };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_property",
        payload: {
          dataset_id: "lineage-dataset",
          identifier: "lineage",
          identifier_type: "column",
        } as any,
      });

      expect(nextPlot.sort_by).toBe("alphabetical");
    });

    it("select_facet_property: does not clobber an already-set sort_by", () => {
      const plot = {
        ...basePlot,
        facet_by: "property" as const,
        sort_by: "num_points" as const,
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_property",
        payload: {
          dataset_id: "lineage-dataset",
          identifier: "lineage",
          identifier_type: "column",
        } as any,
      });

      expect(nextPlot.sort_by).toBe("num_points");
    });

    it("select_filter: sets sort_by once facet_by 'raw_slice' becomes backed by filters.facet1", () => {
      const plot = { ...basePlot, facet_by: "raw_slice" as const };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_filter",
        payload: {
          key: "facet1" as const,
          filter: { name: "Lung" } as any,
        },
      });

      expect(nextPlot.sort_by).toBe("alphabetical");
    });

    it("select_dimension: sets sort_by once facet_by 'custom' becomes backed by a complete dimension", () => {
      const plot = { ...basePlot, facet_by: "custom" as const };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_dimension",
        payload: {
          key: "facet" as const,
          dimension: {
            dataset_id: "some-dataset",
            axis_type: "raw_slice",
            aggregation: "first",
            slice_type: "gene",
            context: {
              name: "KRAS",
              dimension_type: "gene",
              expr: { "==": [{ var: "entity_label" }, "KRAS"] },
              vars: {},
            },
          } as any,
        },
      });

      expect(nextPlot.sort_by).toBe("alphabetical");
    });

    it("select_facet_by: sets sort_by when switching to 'expansion' while an expansion is already active", () => {
      const plot = {
        ...basePlot,
        facet_by: "property" as const,
        expand_by: [
          {
            slice_type: "transcript",
            context: {
              name: "All",
              dimension_type: "transcript",
              expr: true,
              vars: {},
            },
            limit: 9,
          },
        ] as any,
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_by",
        payload: "expansion",
      });

      expect(nextPlot.sort_by).toBe("alphabetical");
    });

    it("select_expansion: sets sort_by the first time an expansion is enabled", () => {
      const nextPlot = plotConfigReducer(basePlot, {
        type: "select_expansion",
        payload: {
          key: "x",
          expand_by: {
            slice_type: "transcript",
            context: {
              name: "All",
              dimension_type: "transcript",
              expr: true,
              vars: {},
            },
            dataset_id: "transcript-dataset",
          },
        },
      });

      expect(nextPlot.sort_by).toBe("alphabetical");
    });

    it("does not set sort_by when facet_by is merely selected but not yet backed", () => {
      const nextPlot = plotConfigReducer(basePlot, {
        type: "select_facet_by",
        payload: "property",
      });

      expect(nextPlot.sort_by).toBeUndefined();
    });

    it("does not re-trigger when the facet axis was already complete before the action", () => {
      // facet_by is already backed by a complete metadata.facet_property;
      // changing to a different, still-complete property must not
      // re-apply the default merely because sort_by happens to be unset —
      // it only fires on the false->true completeness transition.
      const plot = {
        ...basePlot,
        facet_by: "property" as const,
        metadata: {
          facet_property: {
            dataset_id: "lineage-dataset",
            identifier: "lineage",
            identifier_type: "column",
          } as any,
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_facet_property",
        payload: {
          dataset_id: "subtype-dataset",
          identifier: "subtype",
          identifier_type: "column",
        } as any,
      });

      expect(nextPlot.sort_by).toBeUndefined();
    });
  });
});
