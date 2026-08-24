import {
  DataExplorerPlotConfig,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";

export const SHORT_READ_DATASET =
  "OmicsExpressionTranscriptTPMLogp1_MC_HumanAllGenes";

export const LONG_READ_DATASET =
  "OmicsLongReadExpressionTranscriptLogp1HumanAllGenes";

export const EMPTY_TRANSCRIPT_PLOT: DataExplorerPlotConfig = {
  plot_type: "density_1d",
  index_type: "depmap_model",
  dimensions: {
    x: { dataset_id: LONG_READ_DATASET },
  } as DataExplorerPlotConfig["dimensions"],
  color_by: "expansion",
  facet_by: "expansion",
  sort_by: "alphabetical",
  show_regression_line: true,
};

export function makeSetExpansionAction(
  expansionAxis: "x" | "y",
  geneSymbol: string | null,
  dataset_id: string | null
) {
  return {
    type: "select_expansion",
    payload: {
      key: expansionAxis,
      expand_by: {
        slice_type: "transcript",
        dataset_id,
        context: {
          name: geneSymbol,
          dimension_type: "transcript",
          expr: { "==": [{ var: "gene" }, geneSymbol] },
          vars: {
            gene: {
              dataset_id: "transcript_metadata",
              identifier: "Gene",
              identifier_type: "column" as const,
              source: "property" as const,
            },
          },
        },
      },
    },
  } as PlotConfigReducerAction;
}

export function focusWhenElementReady(selector: string): void {
  const tryFocus = (): boolean => {
    const element = document.querySelector<HTMLElement>(selector);

    if (element && !(element as HTMLInputElement).disabled) {
      element.focus();
      return true;
    }

    return false;
  };

  // Immediate success case
  if (tryFocus()) {
    return;
  }

  // Watch for either:
  // - the element being added
  // - the element's disabled attribute changing
  const observer = new MutationObserver(() => {
    if (tryFocus()) {
      observer.disconnect(); // one-shot
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
}

export function makeHandlerForMakeScatter(
  plot: PartialDataExplorerPlotConfig,
  dispatch: (action: PlotConfigReducerAction) => void
) {
  return () => {
    const setScatter = { type: "select_plot_type", payload: "scatter" };
    const geneSymbol = plot.dimensions!.x!.context!.name;

    const setRegLine = {
      type: "select_show_regression_line",
      payload: true,
    };

    const makeY = {
      type: "select_dimension",
      payload: {
        key: "y",
        dimension: {
          axis_type: "raw_slice",
          aggregation: "first",
          slice_type: "gene",
          dataset_id: "expression",
          context: {
            dimension_type: "gene",
            name: geneSymbol,
            expr: { "==": [{ var: "entity_label" }, geneSymbol] },
            vars: {
              symbol: {
                dataset_id: "gene_metadata",
                identifier_type: "column",
                identifier: "label",
              },
            },
          },
        },
      },
    } as any;

    dispatch({ type: "batch", payload: [setScatter, makeY, setRegLine] });
  };
}

export function makeHandlerForSwapAxisConfigs(
  plot: PartialDataExplorerPlotConfig,
  dispatch: (action: PlotConfigReducerAction) => void,
  expansionAxis: "x" | "y"
) {
  return () => {
    const geneSymbol = plot.dimensions?.[expansionAxis]?.context?.name;
    const dataset_id = plot.dimensions?.[expansionAxis]?.dataset_id;

    if (!geneSymbol || !dataset_id) {
      return;
    }

    const nextExpansionAxis = expansionAxis === "x" ? "y" : "x";

    const setExpansion = makeSetExpansionAction(
      nextExpansionAxis,
      geneSymbol,
      dataset_id
    ) as any;

    const setOtherAxis = {
      type: "select_dimension",
      payload: {
        key: expansionAxis,
        dimension: plot.dimensions![nextExpansionAxis],
      },
    };

    dispatch({ type: "batch", payload: [setExpansion, setOtherAxis] });
  };
}
