import React, { useEffect, useState } from "react";
import { AnnotationSelect } from "@depmap/data-explorer-2";
import { SliceQuery } from "@depmap/types";

interface Props {
  index_type_name: string;
  value: SliceQuery | null;
  onChange: (nextSlice: SliceQuery | null) => void;
}

function AddColumnAnnotationSelect({
  value,
  index_type_name,
  onChange,
}: Props) {
  const [tempPartialValue, setTempPartialValue] = useState<Partial<SliceQuery>>(
    value || {
      dataset_id: `${index_type_name}_metadata`,
      identifier_type: "column",
    }
  );

  useEffect(() => {
    if (value) {
      setTempPartialValue(value);
    }
  }, [value]);

  return (
    <AnnotationSelect
      isClearable
      dimension_type={index_type_name}
      dataset_id={tempPartialValue.dataset_id || null}
      identifier={tempPartialValue.identifier || null}
      identifierDisplayLabel={null}
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
