import { makeSetExpansionAction, SHORT_READ_DATASET } from "../../utils";
import { PlotConfigReducerAction } from "@depmap/data-explorer-2/src/components/DataExplorerPage/reducers/plotConfigReducer";

export const makeGeneOnChangeHandler = (
  expansionAxis: "x" | "y",
  currentDatasetId: string | null,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  return (nextGene: string | null) => {
    dispatch(
      makeSetExpansionAction(
        expansionAxis,
        nextGene,
        currentDatasetId || SHORT_READ_DATASET
      )
    );
  };
};

export const makeDatasetOnChangeHandler = (
  expansionAxis: "x" | "y",
  currentGene: string | null,
  dispatch: (action: PlotConfigReducerAction) => void
) => {
  return (nextDatasetId: string | null) => {
    dispatch(makeSetExpansionAction(expansionAxis, currentGene, nextDatasetId));
  };
};
