import React from "react";
import {
  ContextPath,
  DataExplorerContextV2,
  FilterKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import ContextSelectorV2 from "../../../ContextSelectorV2";
import { PlotConfigReducerAction } from "../../reducers/plotConfigReducer";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  filterKeys: FilterKey[];
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContextV2,
    pathToSave: ContextPath
  ) => void;
  labels?: (React.ReactNode | null)[];
  includeAllInOptions?: boolean;
}

function FilterViewOptions({
  plot,
  dispatch,
  filterKeys,
  onClickCreateContext,
  onClickSaveAsContext,
  labels = [],
  includeAllInOptions = false,
}: Props) {
  const { index_type, filters } = plot;

  return (
    <div>
      {filterKeys.map((filterKey, index: number) => (
        <ContextSelectorV2
          key={filterKey}
          show
          includeAllInOptions={includeAllInOptions}
          label={labels[index] || undefined}
          enable={!!index_type}
          value={(filters?.[filterKey] as DataExplorerContextV2) || null}
          dimension_type={index_type as string}
          onClickCreateContext={() => {
            onClickCreateContext(["filters", filterKey]);
          }}
          onClickSaveAsContext={() => {
            const context = filters![filterKey];
            onClickSaveAsContext(context as DataExplorerContextV2, [
              "filters",
              filterKey,
            ]);
          }}
          onChange={(filter) => {
            dispatch({
              type: "select_filter",
              payload: { key: filterKey, filter },
            });
          }}
        />
      ))}
    </div>
  );
}

export default FilterViewOptions;
