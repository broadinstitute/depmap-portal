/* eslint-disable react/jsx-props-no-spreading */
import React from "react";
import renderConditionally from "../../../utils/render-conditionally";
import CustomSliceLabelSelect from "./CustomSliceLabelSelect";
import CompoundSliceLabelSelect from "./CompoundSliceLabelSelect";
import StandardSliceLabelSelect from "./SliceLabelSelect";
import { SliceLabelSelectProps } from "./types";

const SliceLabelSelect = renderConditionally((props: SliceLabelSelectProps) => {
  if (props.dataType === "custom") {
    return <CustomSliceLabelSelect {...props} />;
  }

  if (props.slice_type === "compound_experiment") {
    return (
      <CompoundSliceLabelSelect
        {...props}
        onChange={(slice_label, dataset_id) => {
          const context = slice_label
            ? {
                context_type: "compound_experiment",
                name: slice_label,
                expr: { "==": [{ var: "slice_label" }, slice_label] },
              }
            : null;

          if (props.onChangeCompound) {
            props.onChangeCompound(context, dataset_id);
          } else {
            props.onChange(context);
          }
        }}
      />
    );
  }

  return <StandardSliceLabelSelect {...props} />;
});

export default SliceLabelSelect;
