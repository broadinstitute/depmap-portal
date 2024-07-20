import React from "react";
import cx from "classnames";
import ContextSelector from "../ContextSelector";
import DataTypeSelect from "./DataTypeSelect";
import UnitsSelect from "./UnitsSelect";
import EntityTypeSelect from "./EntityTypeSelect";
import AxisTypeToggle from "./AxisTypeToggle";
import EntitySelect from "./EntitySelect";
import DataVersionSelect from "./DataVersionSelect";
import AggregationSelect from "./AggregationSelect";
import useDimensionStateManager from "./useDimensionStateManager";
import styles from "../../styles/DimensionSelect.scss";

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
}

function AllSelects({
  index_type,
  mode,
  includeAllInContextOptions,
  isModalVersion,
  state,
  onClickCreateContext,
  onClickSaveAsContext,
  onClickShowModal = undefined,
  className = undefined,
}: Props) {
  const {
    dataType,
    units,
    dataTypeOptions,
    dataVersionOptions,
    entityTypeOptions,
    unitsOptions,
    dimension: { aggregation, axis_type, context, dataset_id, entity_type },
    isLoading,
    isSingleCompound,
    noMatchingContexts,
    onChangeAggregation,
    onChangeAxisType,
    onChangeCompound,
    onChangeContext,
    onChangeDataType,
    onChangeDataVersion,
    onChangeEntityType,
    onChangeUnits,
  } = state;

  return (
    <div className={cx(styles.DimensionSelect, className)}>
      <DataTypeSelect
        value={dataType}
        options={dataTypeOptions}
        onChange={onChangeDataType}
        isLoading={isLoading}
        hasError={noMatchingContexts}
      />
      <EntityTypeSelect
        index_type={index_type}
        axis_type={axis_type as "entity" | "context"}
        aggregation={aggregation || null}
        value={entity_type || null}
        options={entityTypeOptions}
        onChange={onChangeEntityType}
        isLoading={isLoading}
      />
      <AxisTypeToggle
        show={Boolean(entity_type && mode === "entity-or-context")}
        disabled={dataType === "custom"}
        value={axis_type as "entity" | "context"}
        onChange={onChangeAxisType}
      />
      <EntitySelect
        show={Boolean(entity_type) && axis_type === "entity"}
        value={context || null}
        onChange={onChangeContext}
        dataType={dataType}
        entity_type={entity_type as string}
        dataset_id={dataset_id || null}
        units={units || null}
        onChangeCompound={onChangeCompound}
      />
      <ContextSelector
        enable
        show={axis_type === "context" && entity_type !== undefined}
        value={context || null}
        onChange={onChangeContext}
        context_type={entity_type as string}
        includeAllInOptions={includeAllInContextOptions}
        onClickCreateContext={onClickCreateContext}
        onClickSaveAsContext={onClickSaveAsContext}
      />
      <AggregationSelect
        show={axis_type === "context" && aggregation !== "correlation"}
        value={aggregation as string}
        onChange={onChangeAggregation}
      />
      <UnitsSelect
        show={Boolean(dataType && !isSingleCompound && isModalVersion)}
        value={units}
        options={unitsOptions}
        onChange={onChangeUnits}
        isLoading={isLoading}
      />
      <DataVersionSelect
        show={Boolean(dataType || dataset_id) && !isSingleCompound}
        isLoading={isLoading}
        value={dataset_id || null}
        options={dataVersionOptions}
        onChange={onChangeDataVersion}
        showDefaultHint={
          Boolean(!dataType || !entity_type || !context) ||
          Boolean(isModalVersion && !units)
        }
        showNoDefaultHint={dataVersionOptions.every((o) => !o.isDefault)}
        onClickShowModal={onClickShowModal}
      />
    </div>
  );
}

export default AllSelects;
