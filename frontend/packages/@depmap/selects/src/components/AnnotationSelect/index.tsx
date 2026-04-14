/* eslint-disable
jsx-a11y/no-static-element-interactions,
jsx-a11y/click-events-have-key-events */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import cx from "classnames";
import { SliceQuery } from "@depmap/types";
import useChainSelectorData, { SourceTable } from "./useChainSelectorData";
import AnnotationSourcePicker from "./AnnotationSourcePicker";
import ChainColumnPicker from "./ChainColumnPicker";
import MatrixAnnotationPicker from "./MatrixAnnotationPicker";
import { flattenSliceQuery } from "./sliceQueryUtils";
import type { MatrixSliceMetadata, TableDescriptor } from "./types";
import styles from "../../styles/AnnotationSelect.scss";

interface Props {
  index_type: string;
  value: SliceQuery | null;
  onChange: (value: SliceQuery | null, meta?: MatrixSliceMetadata) => void;
  className?: string;
  /** Optional hint to pre-select a source table on mount (when value is null). */
  initialDatasetId?: string;
  /** Portal target for dropdown menus (for rendering inside modals). */
  menuPortalTarget?: HTMLElement | null;
  /** Dataset IDs (id or given_id) to exclude from the source list and FK chains. */
  hiddenDatasets?: Set<string>;
  /** SliceQueries that should appear disabled (not selectable) in the column list. */
  disabledSlices?: SliceQuery[];
  /** SliceQueries that should be hidden entirely from the column list. */
  hiddenSlices?: SliceQuery[];
  /** Display label for the current value (used by matrix picker when id ≠ label). */
  valueLabel?: string;
}

/**
 * AnnotationSelect — top-level annotation selector.
 *
 * Orchestrates:
 *   Widget 1: AnnotationSourcePicker (tabular + matrix annotation datasets)
 *   Widget 2: Dispatches to ChainColumnPicker (tabular) or
 *             MatrixAnnotationPicker (matrix) based on selected source format.
 */
export default function AnnotationSelect({
  index_type,
  value,
  onChange,
  className = undefined,
  initialDatasetId = undefined,
  menuPortalTarget = document.body,
  hiddenDatasets = undefined,
  disabledSlices = undefined,
  hiddenSlices = undefined,
  valueLabel = undefined,
}: Props) {
  const {
    isLoading,
    sourceTables,
    dimTypeMap,
    tablesByDim,
  } = useChainSelectorData(index_type);

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // ── Hidden dataset filtering ──

  const isDatasetHidden = useCallback(
    (id: string, given_id: string | null): boolean => {
      if (!hiddenDatasets || hiddenDatasets.size === 0) return false;

      return (
        hiddenDatasets.has(id) ||
        (given_id !== null && hiddenDatasets.has(given_id))
      );
    },
    [hiddenDatasets]
  );

  const filteredSourceTables = useMemo(() => {
    if (!hiddenDatasets || hiddenDatasets.size === 0) return sourceTables;

    return sourceTables.filter((t) => !isDatasetHidden(t.id, t.given_id));
  }, [sourceTables, hiddenDatasets, isDatasetHidden]);

  // Filter tablesByDim so hidden datasets don't appear in FK chain walking.
  const filteredTablesByDim = useMemo(() => {
    if (!hiddenDatasets || hiddenDatasets.size === 0) return tablesByDim;

    const filtered: Record<string, TableDescriptor[]> = {};

    for (const [dim, tables] of Object.entries(tablesByDim)) {
      const visible = tables.filter((t) => !isDatasetHidden(t.id, t.given_id));

      if (visible.length > 0) {
        filtered[dim] = visible;
      }
    }

    return filtered;
  }, [tablesByDim, hiddenDatasets, isDatasetHidden]);

  // ── Source derivation ──

  const valueRootDatasetId = useMemo(() => {
    if (!value) return null;

    const steps = flattenSliceQuery(value);
    return steps[0].dataset_id;
  }, [value]);

  const findSourceByDatasetId = useCallback(
    (datasetId: string | null): SourceTable | null => {
      if (!datasetId) return null;

      return (
        filteredSourceTables.find(
          (t) => t.id === datasetId || t.given_id === datasetId
        ) ?? null
      );
    },
    [filteredSourceTables]
  );

  useEffect(() => {
    if (filteredSourceTables.length === 0) {
      setSelectedSourceId(null);
      return;
    }

    const fromValue = findSourceByDatasetId(valueRootDatasetId);
    if (fromValue) {
      setSelectedSourceId(fromValue.id);
      return;
    }

    if (
      selectedSourceId &&
      filteredSourceTables.some((t) => t.id === selectedSourceId)
    ) {
      return;
    }

    const fromInit = findSourceByDatasetId(initialDatasetId ?? null);
    if (fromInit) {
      setSelectedSourceId(fromInit.id);
      return;
    }

    const primary = filteredSourceTables.find((t) => t.isPrimary);
    setSelectedSourceId(primary ? primary.id : filteredSourceTables[0].id);
  }, [
    filteredSourceTables,
    valueRootDatasetId,
    initialDatasetId,
    selectedSourceId,
    findSourceByDatasetId,
  ]);

  const selectedSource = useMemo(() => {
    return filteredSourceTables.find((t) => t.id === selectedSourceId) ?? null;
  }, [filteredSourceTables, selectedSourceId]);

  const handleSourceSelect = useCallback(
    (table: SourceTable) => {
      setSelectedSourceId(table.id);

      if (value) {
        onChange(null);
      }
    },
    [value, onChange]
  );

  return (
    <div className={cx(styles.root, className)}>
      <AnnotationSourcePicker
        sourceTables={filteredSourceTables}
        selectedSourceId={selectedSourceId}
        onSelect={handleSourceSelect}
        menuPortalTarget={menuPortalTarget}
        isLoading={isLoading}
      />
      <div className={styles.spacer} data-spacer />
      <div>
        {selectedSource?.format === "matrix_dataset" ? (
          <MatrixAnnotationPicker
            dataset_id={selectedSource.given_id || selectedSource.id}
            dataset_name={selectedSource.displayName}
            sliceType={selectedSource.sliceType}
            identifierType={selectedSource.identifierType || "feature_id"}
            value={value}
            onChange={onChange}
            menuPortalTarget={menuPortalTarget}
            valueLabel={valueLabel}
          />
        ) : (
          <ChainColumnPicker
            index_type={index_type}
            value={value}
            onChange={onChange}
            selectedSource={selectedSource ?? undefined}
            tablesByDim={filteredTablesByDim}
            dimTypeMap={dimTypeMap}
            menuPortalTarget={menuPortalTarget}
            disabledSlices={disabledSlices}
            hiddenSlices={hiddenSlices}
            isLoading={isLoading || !selectedSource}
          />
        )}
      </div>
    </div>
  );
}
