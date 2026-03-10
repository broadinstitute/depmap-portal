import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationSelect } from "@depmap/data-explorer-2";
import { SliceQuery } from "@depmap/types";

interface Props {
  value: SliceQuery | null;
  index_type_name: string;
  idColumnLabel: string;
  onChange: (nextSlice: SliceQuery | null) => void;
  hiddenDatasets?: Set<string>;
  existingSlices?: SliceQuery[];
}

function AddColumnAnnotationSelect({
  value,
  index_type_name,
  idColumnLabel,
  onChange,
  hiddenDatasets = undefined,
  existingSlices = undefined,
}: Props) {
  const initialValue = useRef(value);

  const [tempPartialValue, setTempPartialValue] = useState<
    Partial<SliceQuery>
  >();

  useEffect(() => {
    if (value) {
      setTempPartialValue(value);
    }
  }, [value]);

  const disabledAnnotations = useMemo(() => {
    const out = new Set<string>();

    for (const slice of existingSlices || []) {
      if (
        slice.dataset_id === tempPartialValue?.dataset_id &&
        slice.identifier !== tempPartialValue?.identifier &&
        slice.identifier !== initialValue.current?.identifier
      ) {
        out.add(slice.identifier);
      }
    }

    return out;
  }, [existingSlices, tempPartialValue]);

  const hiddenAnnotations = useMemo(() => {
    return new Set(["label", idColumnLabel]);
  }, [idColumnLabel]);

  return (
    <AnnotationSelect
      isClearable
      dimension_type={index_type_name}
      dataset_id={tempPartialValue?.dataset_id || null}
      identifier={tempPartialValue?.identifier || null}
      identifierDisplayLabel={null}
      hiddenDatasets={hiddenDatasets}
      disabledAnnotations={disabledAnnotations}
      hiddenAnnotations={hiddenAnnotations}
      onChangeSourceDataset={(dataset_id, identifier_type) => {
        onChange(null);
        setTempPartialValue({ dataset_id, identifier_type });
      }}
      onChangeAnnotationSlice={async (identifier: string | null) => {
        if (!identifier) {
          onChange(null);
          setTempPartialValue((prev) => ({
            ...prev,
            identifier: undefined,
          }));
          return;
        }

        const prevTpv = tempPartialValue;
        const nextValue = { ...prevTpv, identifier } as SliceQuery;
        onChange(nextValue);
      }}
    />
  );
}

export default AddColumnAnnotationSelect;
