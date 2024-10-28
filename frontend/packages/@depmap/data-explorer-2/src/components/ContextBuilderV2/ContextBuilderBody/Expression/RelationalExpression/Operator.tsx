import React, { useRef } from "react";
import { useContextBuilderState } from "../../../state/ContextBuilderState";
import PlotConfigSelect from "../../../../PlotConfigSelect";
import {
  getOperator,
  operatorsByValueType,
  opLabels,
  RelationExpr,
  ValueType,
} from "../../../utils/expressionUtils";
import { scrollParentIntoView } from "../../../utils/domUtils";
import styles from "../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: RelationExpr;
  path: (string | number)[];
  varName: string | null;
  isLoading: boolean;
}

function Operator({ expr, path, varName, isLoading }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { vars } = useContextBuilderState();
  const { dispatch, fullySpecifiedVars } = useContextBuilderState();

  const variable = varName ? vars[varName] : null;
  const value_type = variable?.value_type || null;
  const op = getOperator(expr);

  const options = value_type
    ? Object.fromEntries(
        Object.entries(opLabels).filter(([key]) => {
          return operatorsByValueType[value_type as ValueType].has(key);
        })
      )
    : [];

  return (
    <PlotConfigSelect
      show
      innerRef={ref}
      enable={!isLoading && !!varName && fullySpecifiedVars.has(varName)}
      isLoading={isLoading}
      className={styles.Operator}
      placeholder="…"
      value={op}
      options={options}
      onChange={(nextOp) => {
        let innerExpr = expr[op];
        const lhs = innerExpr[0];
        const rhs = innerExpr[1];

        if (["==", "!="].includes(op) && ["in", "!in"].includes(nextOp!)) {
          innerExpr = [lhs, typeof rhs === "string" ? [rhs] : null];
        }

        if (["in", "!in"].includes(op) && ["==", "!="].includes(nextOp!)) {
          innerExpr = [
            lhs,
            Array.isArray(rhs) && rhs.length > 0 ? rhs[0] : null,
          ];
        }

        dispatch({
          type: "update-value",
          payload: {
            path,
            value: { [nextOp!]: innerExpr },
          },
        });

        scrollParentIntoView(ref.current);
      }}
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default Operator;
