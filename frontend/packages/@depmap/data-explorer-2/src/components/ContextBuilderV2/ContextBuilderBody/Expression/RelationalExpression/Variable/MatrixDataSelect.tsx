import React from "react";
import DimensionSelect from "../../../../../DimensionSelect";
import useDimensionType from "../../../../hooks/useDimensionType";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  varName: string;
}

function MatrixDataSelect({ varName }: Props) {
  const { dimension_type } = useContextBuilderState();
  const { getDimensionTypeAsync } = useDimensionType();
  const { vars, setVar } = useContextBuilderState();
  const variable = vars[varName] || null;

  // TODO: Create a version of this that uses DataExplorerContextV2 and talk
  // directly to Breadbox.
  return (
    <DimensionSelect
      mode="entity-only"
      removeWrapperDiv
      index_type={dimension_type}
      value={{
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: variable?.slice_type,
        dataset_id: variable?.dataset_id,
        context:
          variable?.identifier && variable?.slice_type
            ? {
                context_type: variable.slice_type,
                name: variable.identifier,
                expr: { "==": [{ var: "entity_label" }, variable.identifier] },
              }
            : undefined,
      }}
      onChange={async (nextDimension) => {
        const dimensionType = await getDimensionTypeAsync();

        const identifier_type =
          dimensionType.axis === "sample" ? "feature_label" : "sample_label";

        setVar(varName, {
          dataset_id: nextDimension.dataset_id,
          identifier_type,
          identifier: nextDimension.context?.name,
          source: "matrix",
          value_type: "continuous",
          slice_type: nextDimension.slice_type,
        });
      }}
    />
  );
}

export default MatrixDataSelect;
