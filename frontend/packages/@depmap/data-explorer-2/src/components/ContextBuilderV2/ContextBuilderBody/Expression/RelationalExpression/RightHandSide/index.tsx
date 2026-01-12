import React, { useEffect } from "react";
import { isValidSliceQuery } from "@depmap/types";
import { DataExplorerApiResponse } from "../../../../../../services/dataExplorerAPI";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";
import {
  isListOperator,
  OperatorType,
} from "../../../../utils/expressionUtils";
import StringConstant from "./StringConstant";
import StringList from "./StringList";
import NumberInput from "./NumberInput";
import useSlicePreview from "./useSlicePreview";

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

  const { handleClickShowSlicePreview } = useSlicePreview({
    expr,
    op,
    path,
    variable,
  });

  if (isListOperator(op)) {
    return (
      <StringList
        expr={expr as string[] | null}
        path={path}
        domain={domain as { unique_values: string[] } | null}
        isLoading={isLoading}
        onClickShowSlicePreview={handleClickShowSlicePreview}
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
        onClickShowSlicePreview={handleClickShowSlicePreview}
      />
    );
  }

  return (
    <StringConstant
      expr={expr as string | null}
      path={path}
      domain={domain}
      isLoading={isLoading}
      onClickShowSlicePreview={handleClickShowSlicePreview}
    />
  );
}

export default RightHandSide;
