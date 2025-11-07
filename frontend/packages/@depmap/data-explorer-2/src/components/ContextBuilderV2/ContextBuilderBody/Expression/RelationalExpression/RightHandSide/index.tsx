import React, { useCallback, useEffect } from "react";
import { showInfoModal } from "@depmap/common-components";
import { SlicePreview } from "@depmap/slice-table";
import { isValidSliceQuery, SliceQuery } from "@depmap/types";
import { usePlotlyLoader } from "../../../../../../contexts/PlotlyLoaderContext";
import { DataExplorerApiResponse } from "../../../../../../services/dataExplorerAPI";
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
  const { dimension_type, dispatch, vars } = useContextBuilderState();
  const variable = varName ? vars[varName] : null;

  useEffect(() => {
    if (expr && variable && !isValidSliceQuery(variable)) {
      dispatch({
        type: "update-value",
        payload: { path, value: null },
      });
    }
  }, [dispatch, expr, path, variable]);

  const PlotlyLoader = usePlotlyLoader();

  const handleClickShowDistribution = useCallback(() => {
    showInfoModal({
      title: `${variable!.label || variable!.identifier} distribution`,
      content: (
        <SlicePreview
          value={variable as SliceQuery}
          index_type_name={dimension_type}
          PlotlyLoader={PlotlyLoader}
        />
      ),
    });
  }, [dimension_type, PlotlyLoader, variable]);

  if (isListOperator(op)) {
    return (
      <StringList
        expr={expr as string[] | null}
        path={path}
        domain={domain as { unique_values: string[] } | null}
        isLoading={isLoading}
        onClickShowDistribution={handleClickShowDistribution}
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
        onClickShowDistribution={handleClickShowDistribution}
      />
    );
  }

  return (
    <StringConstant
      expr={expr as string | null}
      path={path}
      domain={domain}
      isLoading={isLoading}
      onClickShowDistribution={handleClickShowDistribution}
    />
  );
}

export default RightHandSide;
