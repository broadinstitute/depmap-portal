/* eslint-disable react/jsx-props-no-spreading */
import React from "react";
import renderConditionally from "../../../utils/render-conditionally";
import { capitalize, getDimensionTypeLabel } from "../../../utils/misc";
import CustomSliceLabelSelect from "./CustomSliceLabelSelect";
import CompoundSliceLabelSelect from "./CompoundSliceLabelSelect";
import StandardSliceLabelSelect from "./SliceLabelSelect";
import { SliceLabelSelectProps } from "./types";

function SliceLabelSelect(props: SliceLabelSelectProps) {
  if (props.dataType === "custom") {
    return <CustomSliceLabelSelect {...props} />;
  }

  if (props.slice_type === "compound_experiment" && !props.removeWrapperDiv) {
    return (
      <CompoundSliceLabelSelect
        {...props}
        onChange={(slice_label, dataset_id) => {
          const context = slice_label
            ? {
                context_type: "compound_experiment",
                name: slice_label,
                expr: { "==": [{ var: "entity_label" }, slice_label] },
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

  let label: string | undefined;

  if (props.removeWrapperDiv) {
    label = `${capitalize(getDimensionTypeLabel(props.slice_type))}`;

    if (label.length > 24) {
      label = label.slice(0, 24) + "…";
    }
  }

  return <StandardSliceLabelSelect {...props} label={label} />;
}

export default renderConditionally(SliceLabelSelect);
