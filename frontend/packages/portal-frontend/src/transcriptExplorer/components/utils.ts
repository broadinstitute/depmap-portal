import { DataExplorerPlotConfig } from "@depmap/types";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";

export const SHORT_READ_DATASET =
  "OmicsExpressionTranscriptTPMLogp1_MC_HumanAllGenes";

export const LONG_READ_DATASET =
  "OmicsLongReadExpressionTranscriptLogp1HumanAllGenes";

// Default page size ("Max transcripts to show"). Mirrors the platform's
// DEFAULT_EXPANSION_LIMIT; the hard ceiling is MAX_EXPANSION_MEMBERS.
export const DEFAULT_MAX_TRANSCRIPTS = 9;

export const EMPTY_TRANSCRIPT_PLOT: DataExplorerPlotConfig = {
  plot_type: "density_1d",
  index_type: "depmap_model",
  dimensions: {
    x: { dataset_id: SHORT_READ_DATASET },
  } as DataExplorerPlotConfig["dimensions"],
  color_by: "expansion",
  group_by: "expansion",
  sort_by: "alphabetical",
  show_regression_line: true,
};

export function makeSetExpansionAction(
  expansionAxis: "x" | "y",
  geneSymbol: string | null,
  dataset_id: string | null,
  limit: number = DEFAULT_MAX_TRANSCRIPTS,
  offset: number = 0
) {
  if (!geneSymbol || !dataset_id) {
    return {
      type: "batch",
      payload: [
        {
          type: "select_expansion",
          payload: { key: expansionAxis, expand_by: null },
        },
        {
          type: "select_dimension",
          payload: { key: expansionAxis, dimension: {} },
        },
      ],
    } as PlotConfigReducerAction;
  }

  return {
    type: "select_expansion",
    payload: {
      key: expansionAxis,
      expand_by: {
        slice_type: "transcript",
        dataset_id,
        limit,
        offset,
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

export function canShowIdentityLine(
  xDim?: { dataset_id?: string | undefined },
  yDim?: { dataset_id?: string | undefined }
) {
  if (!xDim || !yDim) {
    return false;
  }

  const equivalentDatasets: (string | undefined)[] = [
    "expression",
    SHORT_READ_DATASET,
    LONG_READ_DATASET,
  ];

  return (
    equivalentDatasets.includes(xDim.dataset_id) &&
    equivalentDatasets.includes(yDim.dataset_id)
  );
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
