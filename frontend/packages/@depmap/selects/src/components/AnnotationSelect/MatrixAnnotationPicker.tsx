import React, { useCallback, useMemo } from "react";
import { SliceQuery } from "@depmap/types";
import { MatrixSliceMetadata } from "./types";
import SliceSelect from "../SliceSelect";

interface Props {
  dataset_id: string;
  dataset_name: string;
  sliceType: string | null;
  identifierType: "feature_id" | "sample_id";
  value: SliceQuery | null;
  onChange: (value: SliceQuery | null, meta?: MatrixSliceMetadata) => void;
  menuPortalTarget?: HTMLElement | null;
  /** Display label for the current value. Falls back to identifier if not provided. */
  valueLabel?: string;
}

interface SliceSelection {
  id: string;
  label: string;
}

/**
 * MatrixAnnotationPicker — selects a feature or sample from a matrix
 * annotation dataset using SliceSelect.
 *
 * Bridges between SliceSelect's { id, label } model and the
 * SliceQuery contract expected by AnnotationSelect.
 */
export default function MatrixAnnotationPicker({
  dataset_id,
  dataset_name,
  sliceType,
  identifierType,
  value,
  onChange,
  menuPortalTarget = undefined,
  valueLabel = undefined,
}: Props) {
  // Bridge: SliceQuery → SliceSelection
  const sliceValue: SliceSelection | null = useMemo(() => {
    if (!value) return null;

    return {
      id: value.identifier,
      label: valueLabel ?? value.identifier,
    };
  }, [value, valueLabel]);

  // Bridge: SliceSelection → SliceQuery
  const handleChange = useCallback(
    (selection: SliceSelection | null) => {
      if (!selection) {
        onChange(null);
        return;
      }

      onChange(
        {
          dataset_id,
          identifier: selection.id,
          identifier_type: identifierType,
        },
        { label: selection.label, slice_type: sliceType }
      );
    },
    [dataset_id, identifierType, onChange, sliceType]
  );

  const isDatasetSpecificSlice = sliceType === null;

  return (
    <SliceSelect
      label="Annotation"
      slice_type={sliceType ?? undefined}
      isDatasetSpecificSlice={isDatasetSpecificSlice}
      dataset_id={dataset_id}
      value={sliceValue}
      onChange={handleChange}
      placeholder={`Search ${dataset_name}…`}
      menuPortalTarget={menuPortalTarget}
    />
  );
}
