import React from "react";
import DimensionSelectV2 from "../../../../../DimensionSelectV2";
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

  return (
    <DimensionSelectV2
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
                dimension_type: variable.slice_type,
                name: variable.label || variable.identifier,
                expr: { "==": [{ var: "given_id" }, variable.identifier] },
                vars: {},
              }
            : undefined,
      }}
      onChange={async (nextDimension) => {
        const dimensionType = await getDimensionTypeAsync();

        const identifier = nextDimension?.context
          ? (nextDimension.context.expr as { "==": [unknown, string] })["=="][1]
          : undefined;

        const identifier_type =
          dimensionType.axis === "sample" ? "feature_id" : "sample_id";

        setVar(varName, {
          dataset_id: nextDimension.dataset_id,
          identifier,
          identifier_type,
          source: "matrix_dataset",
          slice_type: nextDimension.slice_type,
          label: nextDimension.context?.name,
        });
      }}
    />
  );
}

export default MatrixDataSelect;
