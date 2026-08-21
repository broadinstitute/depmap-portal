import React, { useMemo } from "react";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import AllSelects from "./AllSelects";
import { OtherAxisExpansion } from "./useDimensionStateManager/types";
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

  /**
   * Controls whether a context can be used to expand out to multiple features
   * rather than only for aggregation. Does nothing if `mode` is "entity-only".
   *
   *
   * @default false
   */
  allowExpansion?: boolean;

  /**
   * The expansion another axis of the same plot has already defined, if any.
   *
   * There is only ever one expansion per plot, so this axis can't start a
   * second — but it CAN join this one, expanding over the same members while
   * reading them from its own dataset ("short-read transcripts vs long-read
   * transcripts"). Joining is only possible when this axis is over the same
   * type, since it has to look those same members up.
   *
   * So this single prop answers both questions the UI has: whether the
   * Aggregate/Expand toggle is offerable at all, and — once this axis is
   * expanding — whether its member set is its own to edit or inherited.
   *
   * @default null
   */
  otherAxisExpansion?: OtherAxisExpansion;

  /**
   * Use this to force specific datasets to be hidden from the Data Version
   * menu.
   *
   * @default undefined
   */
  datasetIdsToHide?: Set<string>;

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

  /**
   * Lay this out as rows of a grid owned by an ancestor, so that two of these
   * side by side line up control for control — the aggregation method, the
   * expand toggle and the "Save as Context" button all change one axis's
   * height, and without this the other axis's controls drift out of step.
   *
   * The ancestor supplies `grid-template-rows`; see `.dimensions` in
   * ConfigurationPanel.scss. Mutually exclusive with `onHeightChange`.
   *
   * @default false
   */
  asGridRows?: boolean;

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
  allowExpansion = false,
  otherAxisExpansion = null,
  datasetIdsToHide = undefined,
  onHeightChange = undefined,
  removeWrapperDiv = false,
  asGridRows = false,
  onClickCreateContext = () => {},
  onClickSaveAsContext = () => {},
  includeAllInContextOptions = false,
}: Props) {
  if (!index_type) {
    throw new Error("Unexpected null index_type");
  }

  if (mode === "entity-only" && allowExpansion) {
    window.console.warn(
      'Warning: `allowExpansion` is set to true but `mode` is set to "entity-only". This is a no-op.'
    );
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

  const hiddenDatasets = useMemo(() => {
    return datasetIdsToHide || new Set<string>([]);
  }, [datasetIdsToHide]);

  const state = useDimensionStateManager({
    index_type,
    mode,
    value,
    onChange,
    valueTypes,
    hiddenDatasets,
    allowNullFeatureType,
  });

  const onClickShowModal = useModal({
    mode,
    index_type,
    includeAllInContextOptions,
    allowExpansion,
    otherAxisExpansion,
    state,
    onChange,
    valueTypes,
    hiddenDatasets,
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
      asGridRows={asGridRows}
      allowExpansion={allowExpansion}
      otherAxisExpansion={otherAxisExpansion}
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
