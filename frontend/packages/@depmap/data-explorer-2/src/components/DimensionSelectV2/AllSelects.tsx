import React from "react";
import { capitalize } from "../../utils/misc";
import ContextSelectorV2 from "../ContextSelectorV2";
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

const truncate = (s: string) => {
  const MAX = 15;
  return s && s.length > MAX ? `${s.substr(0, MAX)}…` : s;
};

function AllSelects({
  index_type,
  mode,
  isModalVersion,
  state,
  onClickShowModal = undefined,
  className = undefined,
  onHeightChange = undefined,
  removeWrapperDiv = false,
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
        hasError={noMatchingContexts && !isUnknownDataset}
        isUnknownDataset={isUnknownDataset}
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
      />
      <AxisTypeToggle
        show={
          mode === "entity-or-context" &&
          Boolean(slice_type || axis_type === "aggregated_slice")
        }
        disabled={dataType === "custom"}
        value={axis_type as "raw_slice" | "aggregated_slice"}
        onChange={onChangeAxisType}
      />
      <SliceSelect
        show={axis_type === "raw_slice"}
        index_type={index_type}
        dataType={dataType}
        slice_type={slice_type}
        dataset_id={dataset_id || null}
        value={context || null}
        onChange={onChangeContext}
        isUnknownDataset={isUnknownDataset}
        isLoading={isLoading}
      />
      <ContextSelectorV2
        enable
        show={axis_type === "aggregated_slice" && slice_type != null}
        label={(dimensionType) => {
          if (!dimensionType) {
            return "Context";
          }

          return `${truncate(capitalize(dimensionType.display_name))} Context`;
        }}
        value={context || null}
        onChange={onChangeContext}
        context_type={slice_type || ""}
        includeAllInOptions={includeAllInContextOptions}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
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
      />
    </AllSelectsContainer>
  );
}

export default AllSelects;
