import React from "react";
import { capitalize, getDimensionTypeLabel, pluralize } from "../../utils/misc";
import ContextSelectorV2 from "../ContextSelectorV2";
import DataTypeSelect from "./DataTypeSelect";
import UnitsSelect from "./UnitsSelect";
import SliceTypeSelect from "./SliceTypeSelect";
import AxisTypeToggle from "./AxisTypeToggle";
import AggregateOrExpandToggle from "./AggregateOrExpandToggle";
import DimensionSliceSelect from "./DimensionSliceSelect";
import DataVersionSelect from "./DataVersionSelect";
import AggregationSelect from "./AggregationSelect";
import useDimensionStateManager from "./useDimensionStateManager";
import { OtherAxisExpansion } from "./useDimensionStateManager/types";
import AllSelectsContainer from "./AllSelectsContainer";

interface Props {
  className?: string | undefined;
  selectClassName?: string | undefined;
  allowExpansion: boolean;
  otherAxisExpansion: OtherAxisExpansion;
  includeAllInContextOptions: boolean;
  index_type: string | null;
  isModalVersion: boolean;
  mode: "entity-only" | "context-only" | "entity-or-context";
  state: ReturnType<typeof useDimensionStateManager>;
  onClickCreateContext: () => void;
  onClickSaveAsContext: () => void;
  onClickShowModal?: () => void;
  onHeightChange?: (el: HTMLDivElement, prevHeight: number) => void;
  removeWrapperDiv?: boolean;
  asGridRows?: boolean;
}

const truncate = (s: string) => {
  const MAX = 16;
  return s && s.length > MAX ? `${s.substr(0, MAX)}…` : s;
};

function AllSelects({
  index_type,
  mode,
  isModalVersion,
  state,
  onClickShowModal = undefined,
  className = undefined,
  selectClassName = undefined,
  onHeightChange = undefined,
  removeWrapperDiv = false,
  asGridRows = false,
  allowExpansion,
  otherAxisExpansion,
  includeAllInContextOptions,
  onClickCreateContext,
  onClickSaveAsContext,
}: Props) {
  const {
    dataType,
    units,
    dataTypeOptions,
    dataVersionOptions,
    sliceTypeOptions,
    unitsOptions,
    dimension: { aggregation, axis_type, context, dataset_id, slice_type },
    isLoading,
    isUnknownDataset,
    noMatchingContexts,
    onChangeAggregation,
    onChangeAxisType,
    onChangeContext,
    onChangeDataType,
    onChangeDataVersion,
    onChangeSliceType,
    onChangeUnits,
  } = state;

  const isExpanding = aggregation === "expansion";

  // This axis is riding on an expansion another axis defined. It shares that
  // axis's members by construction, so the member set isn't its to edit —
  // only which dataset those members are read from.
  const isJoiningExpansion = Boolean(otherAxisExpansion) && isExpanding;

  // Only one expansion per plot. A second axis can still expand, but only by
  // joining the first — which requires it to be over the same type, since it
  // has to look the same members up in its own dataset.
  const isExpansionDisabled =
    Boolean(otherAxisExpansion) &&
    !isExpanding &&
    otherAxisExpansion!.slice_type !== slice_type;

  const otherTypeLabel = otherAxisExpansion
    ? pluralize(getDimensionTypeLabel(otherAxisExpansion.slice_type))
    : "";

  return (
    // NOTE: when `asGridRows` is set, each child below becomes one row of a
    // grid shared with the opposite axis, so the ORDER of these children is
    // structural rather than incidental — reordering them reorders the rows.
    //
    // Each child must also stay an unconditional element with a `show` prop.
    // Writing `{cond && <UnitsSelect />}` instead would make the child vanish
    // from React.Children entirely, taking its row with it and silently
    // shifting everything below it out of alignment on that axis only.
    <AllSelectsContainer
      className={className}
      onHeightChange={onHeightChange}
      removeWrapperDiv={removeWrapperDiv}
      asGridRows={asGridRows}
    >
      <DataTypeSelect
        value={dataType}
        options={dataTypeOptions}
        onChange={onChangeDataType}
        isLoading={isLoading}
        hasError={noMatchingContexts && !isUnknownDataset}
        isUnknownDataset={isUnknownDataset}
        selectClassName={selectClassName}
      />
      <SliceTypeSelect
        index_type={index_type}
        axis_type={axis_type as "raw_slice" | "aggregated_slice"}
        aggregation={aggregation || null}
        value={slice_type}
        options={sliceTypeOptions}
        onChange={onChangeSliceType}
        isLoading={isLoading}
        isUnknownDataset={isUnknownDataset}
        selectClassName={selectClassName}
      />
      <AxisTypeToggle
        show={
          mode === "entity-or-context" &&
          Boolean(slice_type !== undefined || axis_type === "aggregated_slice")
        }
        value={axis_type as "raw_slice" | "aggregated_slice"}
        onChange={onChangeAxisType}
        slice_type={slice_type}
        dataset_id={dataset_id}
      />
      <AggregateOrExpandToggle
        show={allowExpansion && axis_type === "aggregated_slice"}
        isExpansionDisabled={isExpansionDisabled}
        disabledReason={
          `The other axis is already expanding ${otherTypeLabel}. ` +
          `Only one expansion per plot — point this axis at ${otherTypeLabel} ` +
          `too if you want it to expand over the same ones.`
        }
        value={isExpanding ? "expand" : "aggregate"}
        onChange={onChangeAggregation}
      />
      {/* Grouped deliberately: these two answer the same question ("what are
          you plotting?") and are mutually exclusive, so they share one grid
          row. An axis set to Single then lines up with an axis set to
          Multiple, instead of sitting a row above it. A Fragment counts as a
          single child to React.Children, which is what makes this work. */}
      <>
        <DimensionSliceSelect
          show={axis_type === "raw_slice"}
          index_type={index_type}
          dataType={dataType}
          units={null} // FIXME
          slice_type={slice_type}
          dataset_id={dataset_id || null}
          value={context || null}
          onChange={onChangeContext}
          isUnknownDataset={isUnknownDataset}
          isLoading={isLoading}
          selectClassName={selectClassName}
        />
        <ContextSelectorV2
          // A joining axis shows the members it inherited, but can't change
          // them: they belong to the axis that defined the expansion, and two
          // axes expanding over different sets is not a thing a plot can mean.
          enable={!isJoiningExpansion}
          linkToContextManager
          show={slice_type != null && axis_type === "aggregated_slice"}
          label={(dimensionType) => {
            if (!dimensionType) {
              return "Context";
            }

            const name = truncate(capitalize(dimensionType.display_name));

            return isJoiningExpansion
              ? `${name} Context (same as other axis)`
              : `${name} Context`;
          }}
          value={context || null}
          onChange={onChangeContext}
          dimension_type={slice_type || ""}
          includeAllInOptions={includeAllInContextOptions}
          onClickCreateContext={onClickCreateContext}
          onClickSaveAsContext={onClickSaveAsContext}
          selectClassName={selectClassName}
        />
      </>
      <AggregationSelect
        show={
          axis_type === "aggregated_slice" &&
          aggregation !== "correlation" &&
          aggregation !== "expansion"
        }
        value={aggregation as string}
        onChange={onChangeAggregation}
        selectClassName={selectClassName}
      />
      <UnitsSelect
        show={isModalVersion}
        value={units}
        options={unitsOptions}
        onChange={onChangeUnits}
        isLoading={isLoading}
        selectClassName={selectClassName}
      />
      <DataVersionSelect
        show
        shouldGroupByDataType={!dataType}
        shouldGroupBySliceType={Boolean(dataType) && !slice_type}
        isLoading={isLoading}
        isUnknownDataset={isUnknownDataset}
        index_type={index_type}
        value={dataset_id || null}
        options={dataVersionOptions}
        onChange={onChangeDataVersion}
        showDefaultHint={
          Boolean(!dataType || !slice_type || !context) ||
          Boolean(isModalVersion && !units)
        }
        showNoDefaultHint={dataVersionOptions.every((o) => !o.isDefault)}
        onClickShowModal={onClickShowModal}
        selectClassName={selectClassName}
      />
    </AllSelectsContainer>
  );
}

export default AllSelects;
