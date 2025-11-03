import React, { useCallback } from "react";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import DataSourceSelect from "./DataSourceSelect";
import VariableAnnotationSelect from "./VariableAnnotationSelect";
import VariableDimensionSelect from "./VariableDimensionSelect";

interface Props {
  expr: { var: string } | null;
  path: (string | number)[];
}

const Selects = {
  property: VariableAnnotationSelect,
  custom: VariableDimensionSelect,
};

function Variable({ expr, path }: Props) {
  const { dispatch, vars } = useContextBuilderState();
  const varName = expr?.var || null;
  const slice = varName ? vars[varName] : null;
  const source = slice?.source || null;
  const SliceQuerySelect = source ? Selects[source] : () => null;

  // When the variable's dataset changes, the outer expression may no longer
  // make sense. It may be comparing values not contained in the selected
  // dataset. This makes sure it gets reset.
  const handleInvalidateVariable = useCallback(
    (nextVarName: string) => {
      const nextOp = "==";
      const outerExpr = { [nextOp]: [{ var: nextVarName }, null] };

      dispatch({
        type: "update-value",
        payload: {
          path: path.slice(0, -2),
          value: outerExpr,
        },
      });
    },
    [dispatch, path]
  );

  return (
    <>
      <DataSourceSelect
        expr={expr}
        onInvalidateVariable={handleInvalidateVariable}
      />
      <SliceQuerySelect
        varName={varName as string}
        onInvalidateVariable={handleInvalidateVariable}
      />
    </>
  );
}

export default Variable;
