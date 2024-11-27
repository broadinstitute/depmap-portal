import React from "react";
import DataTypeSelect from "./DataTypeSelect";
import UnitsSelect from "./UnitsSelect";
import SliceTypeSelect from "./SliceTypeSelect";
import AxisTypeToggle from "./AxisTypeToggle";
import SliceSelect from "./SliceSelect";
import DataVersionSelect from "./DataVersionSelect";
import AggregationSelect from "./AggregationSelect";
import useDimensionStateManager from "./useDimensionStateManager";
import AllSelectsContainer from "./AllSelectsContainer";

interface Props {
  className?: string | undefined;
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
}

function AllSelects({
  index_type,
  mode,
  isModalVersion,
  state,
  onClickShowModal = undefined,
  className = undefined,
  onHeightChange = undefined,
  removeWrapperDiv = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  includeAllInContextOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClickCreateContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClickSaveAsContext,
}: Props) {
  if (mode !== "entity-only") {
    throw new Error("Contexts are not yet support in DimensionSelectV2.");
  }

  const {
    dataType,
    units,
    dataTypeOptions,
    dataVersionOptions,
    sliceTypeOptions,
    unitsOptions,
    dimension: { aggregation, axis_type, context, dataset_id, slice_type },
    isLoading,
    noMatchingContexts,
    onChangeAggregation,
    onChangeAxisType,
    onChangeContext,
    onChangeDataType,
    onChangeDataVersion,
    onChangeSliceType,
    onChangeUnits,
  } = state;

  return (
    <AllSelectsContainer
      className={className}
      onHeightChange={onHeightChange}
      removeWrapperDiv={removeWrapperDiv}
    >
      <DataTypeSelect
        value={dataType}
        options={dataTypeOptions}
        onChange={onChangeDataType}
        isLoading={isLoading}
        hasError={noMatchingContexts}
      />
      <SliceTypeSelect
        index_type={index_type}
        axis_type={axis_type as "raw_slice" | "aggregated_slice"}
        aggregation={aggregation || null}
        value={slice_type || null}
        options={sliceTypeOptions}
        onChange={onChangeSliceType}
        isLoading={isLoading}
      />
      <AxisTypeToggle
        show={Boolean(slice_type && (mode as any) === "entity-or-context")}
        disabled={dataType === "custom"}
        value={axis_type as "raw_slice" | "aggregated_slice"}
        onChange={onChangeAxisType}
      />
      <SliceSelect
        show={Boolean(slice_type) && axis_type === "raw_slice"}
        index_type={index_type}
        dataType={dataType}
        slice_type={slice_type as string}
        dataset_id={dataset_id || null}
        value={context || null}
        onChange={onChangeContext}
      />
      {/* TODO: Add support for select a context */}
      <AggregationSelect
        show={axis_type === "aggregated_slice" && aggregation !== "correlation"}
        value={aggregation as string}
        onChange={onChangeAggregation}
      />
      <UnitsSelect
        show={Boolean(dataType && isModalVersion)}
        value={units}
        options={unitsOptions}
        onChange={onChangeUnits}
        isLoading={isLoading}
      />
      <DataVersionSelect
        show={removeWrapperDiv || Boolean(dataType || dataset_id)}
        isLoading={isLoading}
        value={dataset_id || null}
        options={dataVersionOptions}
        onChange={onChangeDataVersion}
        showDefaultHint={
          Boolean(!dataType || !slice_type || !context) ||
          Boolean(isModalVersion && !units)
        }
        showNoDefaultHint={dataVersionOptions.every((o) => !o.isDefault)}
        onClickShowModal={onClickShowModal}
      />
    </AllSelectsContainer>
  );
}

export default AllSelects;
