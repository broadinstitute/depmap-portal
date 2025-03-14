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

  /** optionally add a classname to the container div */
  className?: string;

  /**
   * Controls whether you can select a single sample/feature, a context, or
   * either one.
   *
   * @default "entity-or-context"
   */
  mode?: "entity-only" | "context-only" | "entity-or-context";

  /**
   * If defined, filters the available dataset options to only ones that match
   * the specified value types.
   *
   * @default undefined (included all value types)
   */
  valueTypes?: Set<"continuous" | "text" | "categorical" | "list_strings">;

  /** Called when the height of the container <div> changes. Useful for modals
   * where the available height might be confined. */
  onHeightChange?: (el: HTMLDivElement, prevHeight: number) => void;

  /**
   * Use this if you need to break out of the standard vertically stacked
   * layout.
   *
   * @default false
   */
  removeWrapperDiv?: boolean;

  // These are only relevant when mode is not "entity-only"
  onClickCreateContext?: () => void;
  onClickSaveAsContext?: () => void;
  /** Should you be able to select "All" as your context? */
  includeAllInContextOptions?: boolean;
}

function DimensionSelect({
  index_type,
  value,
  onChange,
  className = undefined,
  mode = "entity-or-context",
  valueTypes = undefined,
  onHeightChange = undefined,
  removeWrapperDiv = false,
  onClickCreateContext = () => {},
  onClickSaveAsContext = () => {},
  includeAllInContextOptions = false,
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

  if (valueTypes && valueTypes !== DimensionSelect.CONTINUOUS_ONLY) {
    window.console.warn(
      "The `valueTypes` prop is not yet implemented and wil be ignored."
    );
  }

  return (
    <AllSelects
      mode={mode}
      state={state}
      className={className}
      index_type={index_type}
      isModalVersion={false}
      removeWrapperDiv={removeWrapperDiv}
      includeAllInContextOptions={includeAllInContextOptions}
      onClickCreateContext={onClickCreateContext}
      onClickSaveAsContext={onClickSaveAsContext}
      onClickShowModal={onClickShowModal}
      onHeightChange={onHeightChange}
    />
  );
}

// Common sets of value types.
DimensionSelect.CONTINUOUS_ONLY = new Set(["continuous"]);

export default wrapWithErrorBoundary(
  DimensionSelect
) as typeof DimensionSelect & { CONTINUOUS_ONLY: Props["valueTypes"] };
