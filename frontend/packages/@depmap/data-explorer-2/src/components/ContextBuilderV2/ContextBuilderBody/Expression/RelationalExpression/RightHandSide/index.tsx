import React, { useEffect } from "react";
import { isValidSliceQuery } from "@depmap/types";
import { DataExplorerApiResponse } from "../../../../../../contexts/DataExplorerApiContext";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import {
  isListOperator,
  OperatorType,
} from "../../../../utils/expressionUtils";
import StringConstant from "./StringConstant";
import StringList from "./StringList";
import NumberInput from "./NumberInput";

interface Props {
  op: OperatorType;
  expr: string | string[] | number | null;
  path: (string | number)[];
  varName: string | null;
  isLoading: boolean;
  domain: DataExplorerApiResponse["fetchVariableDomain"] | null;
}

function RightHandSide({ op, expr, path, varName, isLoading, domain }: Props) {
  const { dispatch, vars } = useContextBuilderState();
  const variable = varName ? vars[varName] : null;

  useEffect(() => {
    if (expr && variable && !isValidSliceQuery(variable)) {
      dispatch({
        type: "update-value",
        payload: { path, value: null },
      });
    }
  }, [dispatch, expr, path, variable]);

  if (isListOperator(op)) {
    return (
      <StringList
        expr={expr as string[] | null}
        path={path}
        domain={domain as { unique_values: string[] } | null}
        isLoading={isLoading}
      />
    );
  }

  if (domain?.value_type === "continuous") {
    return (
      <NumberInput
        expr={expr as number | null}
        path={path}
        domain={domain}
        isLoading={isLoading}
      />
    );
  }

  if (domain?.value_type === "binary") {
    throw new Error("binary variables not supported");
  }

  return (
    <StringConstant
      expr={expr as string | null}
      path={path}
      domain={domain}
      isLoading={isLoading}
    />
  );
}

export default RightHandSide;
