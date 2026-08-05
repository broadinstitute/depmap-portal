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

    // The primary "label" column is always shown as a fixed, read-only
    // column in SliceTable, so it can't be re-added here. This only
    // matches the root label (not one reached through a foreign key
    // chain), since a chained "label" is distinct, addable data.
    const rootLabelSlice: SliceQuery = {
      dataset_id: `${index_type_name}_metadata`,
      identifier_type: "column",
      identifier: "label",
    };

    return [rootLabelSlice, ...(existingSlices || [])].filter((s1) =>
      slicesToKeepEnabled.every((s2) => !areSliceQueriesEqual(s1, s2!))
    );
  }, [existingSlices, value, index_type_name]);

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
