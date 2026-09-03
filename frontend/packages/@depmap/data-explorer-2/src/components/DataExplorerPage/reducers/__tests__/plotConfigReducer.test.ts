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
      expand_by: [{ slice_type: "transcript", context: {} as any }],
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
      expand_by: [{ slice_type: "transcript", context: {} as any }],
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
      expand_by: [{ slice_type: "transcript", context: {} as any }],
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

  describe("only an axis can expand", () => {
    it("demotes a sentinel on the color dimension", () => {
      // Nothing in the UI produces this, but a hand-authored link can. It used
      // to half-work: normalize counted color as an expanding dimension and so
      // kept expand_by alive, while the context reconciliation — which only
      // ever looked at x and y — left color's context free to drift from it.
      const plot = {
        plot_type: "density_1d" as const,
        index_type: "depmap_model",
        color_by: "custom" as const,
        expand_by: [{ slice_type: "transcript", context: {} as any }],
        dimensions: {
          x: {
            axis_type: "aggregated_slice" as const,
            aggregation: "expansion" as const,
            dataset_id: "short_read",
            slice_type: "transcript",
            context: {} as any,
          },
          color: {
            axis_type: "aggregated_slice" as const,
            aggregation: "expansion" as const,
            dataset_id: "qc_scores",
            slice_type: "transcript",
            context: {} as any,
          },
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "set_plot",
        payload: plot,
      });

      expect(nextPlot.dimensions?.color?.aggregation).toBe("mean");
      // x is a real expanding axis, so the expansion itself survives.
      expect(nextPlot.dimensions?.x?.aggregation).toBe("expansion");
      expect(nextPlot.expand_by?.length).toBe(1);
    });

    it("drops the expansion when only a non-axis carried it", () => {
      const plot = {
        plot_type: "density_1d" as const,
        index_type: "depmap_model",
        facet_by: "expansion" as const,
        expand_by: [{ slice_type: "transcript", context: {} as any }],
        dimensions: {
          x: {
            axis_type: "aggregated_slice" as const,
            aggregation: "mean" as const,
            dataset_id: "short_read",
            slice_type: "transcript",
            context: {} as any,
          },
          facet: {
            axis_type: "aggregated_slice" as const,
            aggregation: "expansion" as const,
            dataset_id: "qc_scores",
            slice_type: "transcript",
            context: {} as any,
          },
        },
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "set_plot",
        payload: plot,
      });

      expect(nextPlot.dimensions?.facet?.aggregation).toBe("mean");
      expect(nextPlot.expand_by).toBeUndefined();
      expect(nextPlot.facet_by).toBeUndefined();
    });
  });

  describe("losing the last expanding axis", () => {
    // Only y expands; x is an ordinary aggregate over the same transcripts.
    const expandedOnY = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      color_by: "expansion" as const,
      facet_by: "expansion" as const,
      expand_by: [{ slice_type: "transcript", context: {} as any }],
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "mean" as const,
          dataset_id: "long_read",
          slice_type: "transcript",
          context: {} as any,
        },
        y: {
          axis_type: "aggregated_slice" as const,
          aggregation: "expansion" as const,
          dataset_id: "short_read",
          slice_type: "transcript",
          context: {} as any,
        },
      },
    };

    it("clears color_by and facet_by when a plot type change drops that axis", () => {
      // A 1D plot keeps only x, so the expansion goes with y. Leaving
      // facet_by: "expansion" behind pointed it at an expansion that no longer
      // existed, and the renderer throws outright on that rather than
      // degrading ("mode 'expansion' requires the response to have at least
      // one expansion").
      const nextPlot = plotConfigReducer(expandedOnY, {
        type: "select_plot_type",
        payload: "density_1d",
      });

      expect(nextPlot.dimensions?.y).toBeUndefined();
      expect(nextPlot.expand_by).toBeUndefined();
      expect(nextPlot.facet_by).toBeUndefined();
      expect(nextPlot.color_by).toBeUndefined();
    });

    it("leaves a real faceting alone — only the sentinel is cleared", () => {
      const facetedByProperty = {
        ...expandedOnY,
        color_by: "property" as const,
        facet_by: "property" as const,
      };

      const nextPlot = plotConfigReducer(facetedByProperty, {
        type: "select_plot_type",
        payload: "density_1d",
      });

      // Still valid on an unexpanded plot, so it survives.
      expect(nextPlot.facet_by).toBe("property");
      expect(nextPlot.color_by).toBe("property");
    });

    it("keeps them when the expansion survives the plot type change", () => {
      // Here x is the expanding axis, so switching to 1D keeps it.
      const expandedOnX = {
        ...expandedOnY,
        dimensions: {
          x: { ...expandedOnY.dimensions.y },
          y: { ...expandedOnY.dimensions.x },
        },
      };

      const nextPlot = plotConfigReducer(expandedOnX, {
        type: "select_plot_type",
        payload: "density_1d",
      });

      expect(nextPlot.expand_by?.length).toBe(1);
      expect(nextPlot.facet_by).toBe("expansion");
    });
  });

  describe("keeping expand_by in sync with the expanding axis's context", () => {
    const transcriptsOf = (gene: string) =>
      ({
        name: `${gene} Transcripts`,
        dimension_type: "transcript",
        expr: { "==": [{ var: "gene" }, gene] },
        vars: {
          gene: {
            dataset_id: "transcript_metadata",
            identifier: "Gene",
            identifier_type: "column",
            source: "property",
          },
        },
      } as any);

    const expandedOnCD44 = {
      plot_type: "density_1d" as const,
      index_type: "depmap_model",
      facet_by: "expansion" as const,
      expand_by: [
        {
          slice_type: "transcript",
          context: transcriptsOf("CD44"),
        },
      ],
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "expansion" as const,
          dataset_id: "short_read",
          slice_type: "transcript",
          context: transcriptsOf("CD44"),
        },
      },
    };

    it("follows the expanding axis when its context is replaced wholesale", () => {
      // The Context Builder's save path builds a plot by hand and dispatches
      // set_plot: it writes dimensions[key].context and touches nothing else.
      // Editing "CD44 Transcripts" into "MAPK10 Transcripts" that way used to
      // leave expand_by still resolving CD44's transcripts, so the axis and
      // the members it fanned out over disagreed.
      const editedByHand = {
        ...expandedOnCD44,
        dimensions: {
          x: {
            ...expandedOnCD44.dimensions.x,
            context: transcriptsOf("MAPK10"),
          },
        },
      };

      const nextPlot = plotConfigReducer(expandedOnCD44, {
        type: "set_plot",
        payload: editedByHand,
      });

      expect(nextPlot.dimensions?.x?.context?.name).toBe("MAPK10 Transcripts");
      expect(nextPlot.expand_by?.[0]?.context?.name).toBe("MAPK10 Transcripts");
    });

    it("drags a joined axis along, and does not let it define its own members", () => {
      const withJoinedAxis = {
        ...expandedOnCD44,
        plot_type: "scatter" as const,
        dimensions: {
          ...expandedOnCD44.dimensions,
          y: {
            axis_type: "aggregated_slice" as const,
            aggregation: "expansion" as const,
            dataset_id: "long_read",
            slice_type: "transcript",
            context: transcriptsOf("CD44"),
          },
        },
      };

      // Editing the JOINING axis is reverted — it has no member set of its own
      // to defend, so x (the definer) still decides.
      const editedJoiner = plotConfigReducer(withJoinedAxis, {
        type: "set_plot",
        payload: {
          ...withJoinedAxis,
          dimensions: {
            ...withJoinedAxis.dimensions,
            y: {
              ...withJoinedAxis.dimensions.y,
              context: transcriptsOf("MAPK10"),
            },
          },
        },
      });

      expect(editedJoiner.dimensions?.y?.context?.name).toBe(
        "CD44 Transcripts"
      );
      expect(editedJoiner.expand_by?.[0]?.context?.name).toBe(
        "CD44 Transcripts"
      );

      // Editing the DEFINING axis takes both the expansion and the joiner
      // with it.
      const editedDefiner = plotConfigReducer(withJoinedAxis, {
        type: "set_plot",
        payload: {
          ...withJoinedAxis,
          dimensions: {
            ...withJoinedAxis.dimensions,
            x: {
              ...withJoinedAxis.dimensions.x,
              context: transcriptsOf("MAPK10"),
            },
          },
        },
      });

      expect(editedDefiner.expand_by?.[0]?.context?.name).toBe(
        "MAPK10 Transcripts"
      );
      expect(editedDefiner.dimensions?.y?.context?.name).toBe(
        "MAPK10 Transcripts"
      );
    });

    it("leaves an already-consistent plot untouched", () => {
      const nextPlot = plotConfigReducer(expandedOnCD44, {
        type: "set_plot",
        payload: expandedOnCD44,
      });

      expect(nextPlot.expand_by).toEqual(expandedOnCD44.expand_by);
      expect(nextPlot.dimensions?.x).toEqual(expandedOnCD44.dimensions.x);
    });
  });

  describe("a second axis joining an expansion", () => {
    const transcriptsOfCD44 = {
      name: "CD44",
      dimension_type: "transcript",
      expr: { "==": [{ var: "gene" }, "CD44"] },
      vars: {},
    } as any;

    const transcriptsOfTP53 = {
      ...transcriptsOfCD44,
      name: "TP53",
      expr: { "==": [{ var: "gene" }, "TP53"] },
    } as any;

    // x expands the transcripts of CD44, read from the short-read dataset.
    const expandedOnX = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      facet_by: "expansion" as const,
      expand_by: [
        {
          slice_type: "transcript",
          context: transcriptsOfCD44,
        },
      ],
      dimensions: {
        x: {
          axis_type: "aggregated_slice" as const,
          aggregation: "expansion" as const,
          dataset_id: "short_read",
          slice_type: "transcript",
          context: transcriptsOfCD44,
        },
        y: {
          axis_type: "aggregated_slice" as const,
          aggregation: "mean" as const,
          dataset_id: "long_read",
          slice_type: "transcript",
          context: transcriptsOfTP53,
        },
      },
    };

    it("adopts the existing members and keeps only its own dataset", () => {
      // y asks to expand while x already does. Its own context (TP53) is
      // deliberately ignored — joining means expanding over x's members.
      const nextPlot = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "long_read",
          },
        },
      });

      expect(nextPlot.dimensions?.y?.aggregation).toBe("expansion");
      expect(nextPlot.dimensions?.y?.context?.name).toBe("CD44");
      // The one thing that IS its own — this is the short-read vs long-read
      // comparison the whole feature exists for.
      expect(nextPlot.dimensions?.y?.dataset_id).toBe("long_read");
      expect(nextPlot.dimensions?.x?.dataset_id).toBe("short_read");
      // Joining doesn't redefine anything at the plot level.
      expect(nextPlot.expand_by).toEqual(expandedOnX.expand_by);
    });

    it("lets the defining axis still change the members, and drags the joined axis along", () => {
      const joined = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "long_read",
          },
        },
      });

      // x is the definer (first expanding axis), so this is a redefinition,
      // NOT x joining y. Getting that backwards would snap x's own edit away.
      const nextPlot = plotConfigReducer(joined, {
        type: "select_expansion",
        payload: {
          key: "x",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "short_read",
          },
        },
      });

      expect(nextPlot.expand_by?.[0]?.context?.name).toBe("TP53");
      expect(nextPlot.dimensions?.x?.context?.name).toBe("TP53");
      // y follows: two axes expanding over different member sets is not a
      // thing a plot can mean.
      expect(nextPlot.dimensions?.y?.context?.name).toBe("TP53");
      expect(nextPlot.dimensions?.y?.dataset_id).toBe("long_read");
    });

    it("keeps the expansion alive when only one of the two axes leaves", () => {
      const joined = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "long_read",
          },
        },
      });

      const nextPlot = plotConfigReducer(joined, {
        type: "select_expansion",
        payload: { key: "x", expand_by: null },
      });

      expect(nextPlot.dimensions?.x?.aggregation).toBe("mean");
      // y is still expanding, so the plot is still expanded and still
      // faceted by it.
      expect(nextPlot.expand_by?.length).toBe(1);
      expect(nextPlot.facet_by).toBe("expansion");
      expect(nextPlot.dimensions?.y?.aggregation).toBe("expansion");
    });

    it("pins hand-picked members, and hands the choice back", () => {
      const pinned = plotConfigReducer(expandedOnX, {
        type: "select_expansion_members",
        payload: ["ENST0001", "ENST0002"],
      });

      expect(pinned.expand_by?.[0]?.members).toEqual(["ENST0001", "ENST0002"]);

      const unpinned = plotConfigReducer(pinned, {
        type: "select_expansion_members",
        payload: null,
      });

      // Absent, not empty — absent is what the fetcher reads as "rank for me".
      expect(unpinned.expand_by?.[0]).not.toHaveProperty("members");

      // An empty selection is the same request. "Show none of them" is not a
      // plot, and the table can't tell it from a mis-click.
      const emptied = plotConfigReducer(pinned, {
        type: "select_expansion_members",
        payload: [],
      });

      expect(emptied.expand_by?.[0]).not.toHaveProperty("members");
    });

    it("drops pinned members when the member set changes underneath them", () => {
      const pinned = plotConfigReducer(expandedOnX, {
        type: "select_expansion_members",
        payload: ["ENST0001"],
      });

      // The Context Builder's save path, which writes the dimension's context
      // straight onto the plot and never touches expand_by. A CD44 transcript
      // id names nothing among TP53's.
      const edited = {
        ...pinned,
        dimensions: {
          ...pinned.dimensions,
          x: { ...pinned.dimensions!.x, context: transcriptsOfTP53 },
        },
      };

      const afterGeneChange = plotConfigReducer(pinned, {
        type: "set_plot",
        payload: edited,
      });

      expect(afterGeneChange.expand_by?.[0]?.context?.name).toBe("TP53");
      expect(afterGeneChange.expand_by?.[0]).not.toHaveProperty("members");
    });

    it("keeps pinned members when only a joining axis drifts", () => {
      // y joined the expansion and then had its context knocked out of line.
      // Reconciling that says nothing about the member set, which is still
      // CD44's — so throwing the user's selection away would be gratuitous.
      const joined = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfCD44,
            dataset_id: "long_read",
          },
        },
      });

      const pinned = plotConfigReducer(joined, {
        type: "select_expansion_members",
        payload: ["ENST0001"],
      });

      const edited = {
        ...pinned,
        dimensions: {
          ...pinned.dimensions,
          y: { ...pinned.dimensions!.y, context: transcriptsOfTP53 },
        },
      };

      const afterJoinerDrift = plotConfigReducer(pinned, {
        type: "set_plot",
        payload: edited,
      });

      // The joiner is pulled back into line, and the selection is untouched.
      expect(afterJoinerDrift.dimensions?.y?.context?.name).toBe("CD44");
      expect(afterJoinerDrift.expand_by?.[0]?.members).toEqual(["ENST0001"]);
    });

    it("sheds the retired page-size and window fields", () => {
      // What a link saved before member ranking landed looks like. `limit` and
      // `offset` are inert — nothing reads them — but a re-issue should not
      // carry them forward either, or they would outlive every plot they touch.
      const paged = {
        ...expandedOnX,
        expand_by: [
          {
            slice_type: "transcript",
            context: transcriptsOfCD44,
            limit: 6,
            offset: 12,
          },
        ],
      };

      const nextPlot = plotConfigReducer(paged, {
        type: "select_expansion",
        payload: {
          key: "x",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "short_read",
          },
        },
      });

      expect(nextPlot.expand_by?.[0]).toEqual({
        slice_type: "transcript",
        context: transcriptsOfTP53,
      });
    });

    it("lets a joined axis change its slice type, and stops it expanding", () => {
      const joined = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "long_read",
          },
        },
      });

      // Retyping an axis goes through select_expansion (it still carries the
      // sentinel at the moment of the change), and the state manager clears
      // the context and dataset along with the type. The join branch used to
      // fire regardless and force the expansion's slice_type back on, so the
      // dropdown looked inert — the only visible effect was the dataset
      // vanishing, since the payload's now-empty one was written over it.
      const nextPlot = plotConfigReducer(joined, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "gene",
            context: (undefined as unknown) as any,
            dataset_id: (undefined as unknown) as any,
          },
        },
      });

      expect(nextPlot.dimensions?.y?.slice_type).toBe("gene");
      expect(nextPlot.dimensions?.y?.aggregation).toBe("mean");

      // Retyping ONE axis must not redefine the plot's point set: x keeps
      // expanding the transcripts it was.
      expect(nextPlot.expand_by?.[0]?.slice_type).toBe("transcript");
      expect(nextPlot.expand_by?.[0]?.context?.name).toBe("CD44");
      expect(nextPlot.dimensions?.x?.aggregation).toBe("expansion");
      expect(nextPlot.dimensions?.x?.dataset_id).toBe("short_read");
    });

    it("keeps a joined axis's dataset change from disturbing the members", () => {
      const joined = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "long_read",
          },
        },
      });

      // Same type, different dataset — a genuine join, so the members are
      // still adopted from x.
      const nextPlot = plotConfigReducer(joined, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "third_assay",
          },
        },
      });

      expect(nextPlot.dimensions?.y?.aggregation).toBe("expansion");
      expect(nextPlot.dimensions?.y?.dataset_id).toBe("third_assay");
      expect(nextPlot.dimensions?.y?.context?.name).toBe("CD44");
    });

    it("demotes a joined axis that gets repointed off the expansion's type", () => {
      const joined = plotConfigReducer(expandedOnX, {
        type: "select_expansion",
        payload: {
          key: "y",
          expand_by: {
            slice_type: "transcript",
            context: transcriptsOfTP53,
            dataset_id: "long_read",
          },
        },
      });

      // A data-type change can infer a new slice_type behind the user's back.
      // An expanding axis over genes can't look transcript ids up in its own
      // dataset — it would read all nulls — so it stops expanding instead.
      const nextPlot = plotConfigReducer(joined, {
        type: "select_dimension",
        payload: {
          key: "y",
          dimension: {
            axis_type: "aggregated_slice",
            aggregation: "expansion",
            dataset_id: "gene_expr",
            slice_type: "gene",
            context: {} as any,
          },
        },
      });

      expect(nextPlot.dimensions?.y?.aggregation).toBe("mean");
      // x is untouched and still expanding, so the plot still is.
      expect(nextPlot.expand_by?.length).toBe(1);
      expect(nextPlot.dimensions?.x?.aggregation).toBe("expansion");
    });
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
          facet: {
            ...xDimension,
            context: { ...xDimension.context, name: "SOX2" },
          },
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
          color: {
            ...xDimension,
            context: { ...xDimension.context, name: "BDNF" },
          },
          facet: {
            ...xDimension,
            context: { ...xDimension.context, name: "SOX2" },
          },
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

    it("drops expand_by on select_index_type", () => {
      // An expansion's members sit on the axis opposite the index, so a new
      // index_type can invalidate the pairing outright -- not merely orphan
      // it. This case returns without normalize(), so nothing else would have
      // dropped it until the next action that normalizes.
      const plot = {
        plot_type: "density_1d" as const,
        index_type: "depmap_model",
        dimensions: {
          x: { ...xDimension, aggregation: "expansion" as const },
        },
        expand_by: [
          {
            slice_type: "transcript",
            context: { name: "transcripts of SOX10" } as any,
            members: ["ENST1", "ENST2"],
          },
        ],
      };

      const nextPlot = plotConfigReducer(plot, {
        type: "select_index_type",
        payload: "gene",
      });

      expect(nextPlot.expand_by).toBeUndefined();
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

  describe("hand-picked categories", () => {
    const colored = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      color_by: "property" as const,
      facet_by: "property" as const,
      metadata: {
        color_property: {
          dataset_id: "m",
          identifier: "Lineage",
          identifier_type: "column",
        } as any,
        facet_property: {
          dataset_id: "m",
          identifier: "Disease",
          identifier_type: "column",
        } as any,
      },
      dimensions: { x: {}, y: {} },
    };

    it("pins a choice and hands it back", () => {
      const pinned = plotConfigReducer(colored, {
        type: "select_categories",
        payload: { target: "color", categories: ["Lung", "Skin"] },
      });

      expect(pinned.color_categories).toEqual(["Lung", "Skin"]);
      // Facet's own choice is untouched by color's.
      expect(pinned).not.toHaveProperty("facet_categories");

      const auto = plotConfigReducer(pinned, {
        type: "select_categories",
        payload: { target: "color", categories: null },
      });

      // Absent, not empty — absent is what the renderer reads as "rank for me".
      expect(auto).not.toHaveProperty("color_categories");

      // An empty selection means the same thing. A plot showing no categories
      // is not a plot, and the picker can't tell it from a mis-click.
      expect(
        plotConfigReducer(pinned, {
          type: "select_categories",
          payload: { target: "color", categories: [] },
        })
      ).not.toHaveProperty("color_categories");
    });

    it("drops a choice when its annotation changes", () => {
      const pinned = plotConfigReducer(colored, {
        type: "select_categories",
        payload: { target: "color", categories: ["Lung"] },
      });

      const rebacked = plotConfigReducer(pinned, {
        type: "select_color_property",
        payload: {
          dataset_id: "m",
          identifier: "Sex",
          identifier_type: "column",
        } as any,
      });

      // A different annotation has different categories. Mostly this is
      // hygiene — a stale name simply won't match — but two annotations that
      // share names would otherwise silently constrain the new one.
      expect(rebacked).not.toHaveProperty("color_categories");
    });

    it("drops a choice when its partition goes away entirely", () => {
      const pinned = plotConfigReducer(colored, {
        type: "select_categories",
        payload: { target: "facet", categories: ["Lung"] },
      });

      const unfaceted = plotConfigReducer(pinned, {
        type: "select_facet_by",
        payload: null,
      });

      // Otherwise it sits in the config invisibly and reasserts itself the
      // moment faceting is switched back on, against whatever backs it then.
      expect(unfaceted).not.toHaveProperty("facet_categories");
    });

    it("carries the choices across a swap", () => {
      const pinned = plotConfigReducer(
        plotConfigReducer(colored, {
          type: "select_categories",
          payload: { target: "color", categories: ["Lung"] },
        }),
        {
          type: "select_categories",
          payload: { target: "facet", categories: ["Melanoma"] },
        }
      );

      const swapped = plotConfigReducer(pinned, {
        type: "swap_color_and_facet",
      });

      // The lists are top-level rather than nested in the structures the swap
      // already exchanges, so without carrying them explicitly a swap would
      // apply color's choice to facet's categories.
      expect(swapped.color_categories).toEqual(["Melanoma"]);
      expect(swapped.facet_categories).toEqual(["Lung"]);
    });
  });

  // The per-color regression split only exists while color_by and facet_by are
  // two real, distinct partitions — the same condition that shows its checkbox.
  // Its checkbox disappearing and the option quietly staying set would be the
  // worse failure of the two, so normalize drops it with the condition.
  describe("show_regression_line_per_color", () => {
    const coloredAndFaceted: PartialDataExplorerPlotConfig = {
      plot_type: "scatter" as const,
      index_type: "depmap_model",
      color_by: "property" as const,
      facet_by: "property" as const,
      metadata: {
        color_property: {
          dataset_id: "m",
          identifier: "PrimaryOrMetastasis",
          identifier_type: "column",
        } as any,
        facet_property: {
          dataset_id: "m",
          identifier: "OncotreeLineage",
          identifier_type: "column",
        } as any,
      },
      dimensions: { x: {}, y: {} },
    };

    const turnOn = (plot: PartialDataExplorerPlotConfig) =>
      plotConfigReducer(plot, {
        type: "select_show_regression_line_per_color",
        payload: true,
      });

    it("sticks when both partitions are real and distinct", () => {
      expect(turnOn(coloredAndFaceted).show_regression_line_per_color).toBe(
        true
      );
    });

    it("is absent, not false, when switched back off", () => {
      // Same convention as every other boolean option here: absent is the
      // default, and `false` is junk we refuse to serialize.
      const off = plotConfigReducer(turnOn(coloredAndFaceted), {
        type: "select_show_regression_line_per_color",
        payload: false,
      });

      expect(off).not.toHaveProperty("show_regression_line_per_color");
    });

    it("does not stick on an unfaceted plot", () => {
      const unfaceted = plotConfigReducer(coloredAndFaceted, {
        type: "select_facet_by",
        payload: null,
      });

      expect(turnOn(unfaceted)).not.toHaveProperty(
        "show_regression_line_per_color"
      );
    });

    it("is dropped when faceting is turned off afterwards", () => {
      const unfaceted = plotConfigReducer(turnOn(coloredAndFaceted), {
        type: "select_facet_by",
        payload: null,
      });

      expect(unfaceted).not.toHaveProperty("show_regression_line_per_color");
    });

    it("is dropped when color_by stops being its own partition", () => {
      // "uniform" (no color at all) and "facet" (color defers to the facet
      // key, so every panel is monochromatic) both leave one line per panel.
      ["uniform" as const, "facet" as const].forEach((color_by) => {
        const recolored = plotConfigReducer(turnOn(coloredAndFaceted), {
          type: "select_color_by",
          payload: color_by,
        });

        expect(recolored).not.toHaveProperty("show_regression_line_per_color");
      });
    });

    // Repointing color_by at the annotation facet_by already shows is the one
    // convergence this reducer does NOT catch: select_color_property returns
    // without going through `normalize` (it can't — normalize would strip a
    // scatter's sort_by, which orders the facets). Same weaker arrangement
    // `normalize`'s own comment describes for the hand-picked categories, and
    // tolerable for the same reason: the leftover value is inert. It draws
    // nothing (useScatterPlotData gates on colorMatchesFacet, which sees the
    // response and so catches convergence the config can't express) and it
    // can't be serialized (normalizePlot re-checks on the write path — see its
    // "identical annotation" test). It becomes live again only if color_by is
    // repointed at something distinct, which is when it was last meaningful.
    it("is dropped when the plot type changes away from scatter", () => {
      const density = plotConfigReducer(turnOn(coloredAndFaceted), {
        type: "select_plot_type",
        payload: "density_1d",
      });

      expect(density).not.toHaveProperty("show_regression_line_per_color");
    });
  });
});
