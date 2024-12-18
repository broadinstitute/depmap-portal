import React from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import AllSelects from "../AllSelects";
import useDimensionStateManager from "../useDimensionStateManager";
import { wrapWithErrorBoundary } from "../ErrorBoundary";

export interface Props {
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimensionV2> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimensionV2>) => void;
  includeAllInContextOptions: boolean;
  initialDataType: string | undefined;
  mode: "entity-only" | "context-only" | "entity-or-context";
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
}

function ModalDimensionSelect({
  index_type,
  value,
  onChange,
  includeAllInContextOptions,
  initialDataType,
  mode,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const state = useDimensionStateManager({
    index_type,
    mode,
    value,
    onChange,
    initialDataType,
  });

  return (
    <AllSelects
      mode={mode}
      state={state}
      index_type={index_type}
      onClickCreateContext={onClickCreateContext}
      onClickSaveAsContext={onClickSaveAsContext}
      includeAllInContextOptions={includeAllInContextOptions}
      isModalVersion
    />
  );
}

export default wrapWithErrorBoundary(ModalDimensionSelect);
