import React, { useMemo, useRef } from "react";
import { AnnotationSelect } from "@depmap/selects";
import { areSliceQueriesEqual, SliceQuery } from "@depmap/types";

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

  const disabledSlices = useMemo(() => {
    const slicesToKeepEnabled = [value, initialValue.current].filter(Boolean);

    return (existingSlices || []).filter((s1) =>
      slicesToKeepEnabled.every((s2) => !areSliceQueriesEqual(s1, s2!))
    );
  }, [existingSlices, value]);

  const hiddenSlices = useMemo(() => {
    return [
      {
        dataset_id: `${index_type_name}_metadata`,
        identifier_type: "column" as const,
        identifier: idColumnLabel,
      },
    ];
  }, [idColumnLabel, index_type_name]);

  return (
    <AnnotationSelect
      index_type={index_type_name}
      value={value}
      onChange={onChange}
      hiddenDatasets={hiddenDatasets}
      disabledSlices={disabledSlices}
      hiddenSlices={hiddenSlices}
      // isClearable
      menuPortalTarget={
        document.querySelector("#modal-container") as HTMLElement
      }
    />
  );
}

export default AddColumnAnnotationSelect;
