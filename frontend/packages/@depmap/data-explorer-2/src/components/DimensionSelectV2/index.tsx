import React, { useMemo } from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import AllSelects from "./AllSelects";
import useDimensionStateManager from "./useDimensionStateManager";
import useModal from "./useModal";
import { wrapWithErrorBoundary } from "./ErrorBoundary";

export interface Props {
  index_type: string;
  value: Partial<DataExplorerPlotConfigDimensionV2> | null;
  onChange: (nextValue: Partial<DataExplorerPlotConfigDimensionV2>) => void;

  /** optionally add a classname to the container div */
  className?: string;

  /** optionally to all the react-select components */
  selectClassName?: string;

  /**
   * Controls whether you can select a single sample/feature, a context, or
   * either one.
   *
   * @default "entity-or-context"
   */
  mode?: "entity-only" | "context-only" | "entity-or-context";

  /**
   * Controls whether datasets whose value_type is "text" are displayed
   * as options.
   *
   * @default false
   */
  allowTextValueType?: boolean;

  /**
   * Controls whether datasets whose value_type is "categorical" are displayed
   * as options.
   *
   * @default false
   */
  allowCategoricalValueType?: boolean;

  /**
   * Controls whether datasets whose value_type is "list_strings" are displayed
   * as options.
   *
   * @default false
   */
  allowListStringsValueType?: boolean;

  /**
   * Controls whether datasets that have no feature type will appear as
   * selectable options.
   *
   * @default false
   */
  allowNullFeatureType?: boolean;

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

function DimensionSelectV2({
  index_type,
  value,
  onChange,
  className = undefined,
  selectClassName = undefined,
  mode = "entity-or-context",
  allowTextValueType = false,
  allowCategoricalValueType = false,
  allowListStringsValueType = false,
  allowNullFeatureType = false,
  onHeightChange = undefined,
  removeWrapperDiv = false,
  onClickCreateContext = () => {},
  onClickSaveAsContext = () => {},
  includeAllInContextOptions = false,
}: Props) {
  if (!index_type) {
    throw new Error("Unexpected null index_type");
  }

  const valueTypes = useMemo(() => {
    const allowedValueTypes = new Set<
      "continuous" | "text" | "categorical" | "list_strings"
    >(["continuous"]);

    if (allowTextValueType) {
      allowedValueTypes.add("text");
    }

    if (allowCategoricalValueType) {
      allowedValueTypes.add("categorical");
    }

    if (allowListStringsValueType) {
      allowedValueTypes.add("list_strings");
    }

    return allowedValueTypes;
  }, [
    allowTextValueType,
    allowCategoricalValueType,
    allowListStringsValueType,
  ]);

  const state = useDimensionStateManager({
    index_type,
    mode,
    value,
    onChange,
    valueTypes,
    allowNullFeatureType,
  });

  const onClickShowModal = useModal({
    mode,
    index_type,
    includeAllInContextOptions,
    state,
    onChange,
    valueTypes,
    allowNullFeatureType,
  });

  return (
    <AllSelects
      mode={mode}
      state={state}
      className={className}
      selectClassName={selectClassName}
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

export default wrapWithErrorBoundary(
  DimensionSelectV2
) as typeof DimensionSelectV2;
