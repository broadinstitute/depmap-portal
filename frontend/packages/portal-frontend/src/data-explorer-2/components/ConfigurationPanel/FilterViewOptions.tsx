/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";
import {
  ContextPath,
  DataExplorerContext,
  FilterKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { ContextSelector } from "@depmap/data-explorer-2";
import { PlotConfigReducerAction } from "src/data-explorer-2/reducers/plotConfigReducer";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
  filterKeys: FilterKey[];
  onClickCreateContext: (pathToCreate: ContextPath) => void;
  onClickSaveAsContext: (
    contextToEdit: DataExplorerContext,
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
        <ContextSelector
          key={filterKey}
          show
          includeAllInOptions={includeAllInOptions}
          label={labels[index] || undefined}
          enable={!!index_type}
          value={(filters?.[filterKey] as DataExplorerContext) || null}
          context_type={index_type as string}
          onClickCreateContext={() => {
            onClickCreateContext(["filters", filterKey]);
          }}
          onClickSaveAsContext={() => {
            const context = filters![filterKey] as DataExplorerContext;
            onClickSaveAsContext(context, ["filters", filterKey]);
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
