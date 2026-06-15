import { makeSetExpansionAction, SHORT_READ_DATASET } from "../../utils";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";

export const makeGeneOnChangeHandler = (
  expansionAxis: "x" | "y",
  currentDatasetId: string | null,
  limit: number,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  return (nextGene: string | null) => {
    // Changing the gene changes the transcript set, so preserve the page
    // size but reset pagination to the first window.
    dispatch(
      makeSetExpansionAction(
        expansionAxis,
        nextGene,
        currentDatasetId || SHORT_READ_DATASET,
        limit,
        0
      )
    );
  };
};

export const makeDatasetOnChangeHandler = (
  expansionAxis: "x" | "y",
  currentGene: string | null,
  limit: number,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  return (nextDatasetId: string | null) => {
    // Changing the dataset changes the transcript set, so preserve the page
    // size but reset pagination to the first window.
    dispatch(
      makeSetExpansionAction(
        expansionAxis,
        currentGene,
        nextDatasetId,
        limit,
        0
      )
    );
  };
};

// Pagination: preserve the gene/dataset/page-size and move the window start.
export const makePaginationOnChangeHandler = (
  expansionAxis: "x" | "y",
  geneSymbol: string | null,
  datasetId: string | null,
  limit: number,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  return (nextOffset: number) => {
    dispatch(
      makeSetExpansionAction(
        expansionAxis,
        geneSymbol,
        datasetId,
        limit,
        nextOffset
      )
    );
  };
};

// "Max transcripts to show": set the page size and reset pagination to the
// first window (a stale offset under a new page size would be confusing).
export const makeMaxToShowOnChangeHandler = (
  expansionAxis: "x" | "y",
  geneSymbol: string | null,
  datasetId: string | null,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  return (nextLimit: number) => {
    dispatch(
      makeSetExpansionAction(expansionAxis, geneSymbol, datasetId, nextLimit, 0)
    );
  };
};
