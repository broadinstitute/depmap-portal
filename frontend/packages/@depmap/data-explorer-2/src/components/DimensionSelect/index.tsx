import React from "react";
import { DataExplorerPlotConfigDimension } from "@depmap/types";
import AllSelects from "./AllSelects";
import useDimensionStateManager from "./useDimensionStateManager";
import useModal from "./useModal";
import { wrapWithErrorBoundary } from "./ErrorBoundary";

export interface Props {
  index_type: string | null;
  value: Partial<DataExplorerPlotConfigDimension> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimension>) => void;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;

  /** Should you be able to select "All" as your context? */
  includeAllInContextOptions: boolean;

  /** optionally add a classname to the container div */
  className?: string;

  /**
   * Controls whether you can select a single sample/feature, a context, or
   * either one.
   *
   * @default "entity-or-context"
   */
  mode?: "entity-only" | "context-only" | "entity-or-context";
}

function DimensionSelect({
  index_type,
  value,
  onChange,
  includeAllInContextOptions,
  onClickCreateContext,
  onClickSaveAsContext,
  className = undefined,
  mode = "entity-or-context",
}: Props) {
  const state = useDimensionStateManager({
    index_type,
    mode,
    value,
    onChange,
  });

  const onClickShowModal = useModal({
    mode,
    index_type,
    includeAllInContextOptions,
    state,
    onChange,
  });

  return (
    <AllSelects
      mode={mode}
      state={state}
      className={className}
      index_type={index_type}
      isModalVersion={false}
      includeAllInContextOptions={includeAllInContextOptions}
      onClickCreateContext={onClickCreateContext}
      onClickSaveAsContext={onClickSaveAsContext}
      onClickShowModal={onClickShowModal}
    />
  );
}

export default wrapWithErrorBoundary(DimensionSelect);
