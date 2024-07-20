/* eslint-disable react/jsx-props-no-spreading */
import React from "react";
import renderConditionally from "../../../utils/render-conditionally";
import CustomEntitySelect from "./CustomEntitySelect";
import CompoundEntitySelect from "./CompoundEntitySelect";
import StandardEntitySelect from "./EntitySelect";
import { EntitySelectorProps } from "./types";

const EntitySelect = renderConditionally((props: EntitySelectorProps) => {
  if (props.dataType === "custom") {
    return <CustomEntitySelect {...props} />;
  }

  if (props.entity_type === "compound_experiment") {
    return (
      <CompoundEntitySelect
        {...props}
        onChange={(entity_label, dataset_id) => {
          const context = entity_label
            ? {
                context_type: "compound_experiment",
                name: entity_label,
                expr: { "==": [{ var: "entity_label" }, entity_label] },
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

  return <StandardEntitySelect {...props} />;
});

export default EntitySelect;
