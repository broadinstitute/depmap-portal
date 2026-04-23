import React, { useMemo, useRef } from "react";
import cx from "classnames";
import { useContextBuilderState } from "../../../state/ContextBuilderState";
import PlotConfigSelect from "../../../../PlotConfigSelect";
import {
  getOperator,
  isEmbeddedContextExpression,
  isListOperator,
  isUnaryOperator,
  operatorsByValueType,
  opLabels,
  OperatorType,
  RelationExpr,
} from "../../../utils/expressionUtils";
import { scrollParentIntoView } from "../../../utils/domUtils";
import styles from "../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: RelationExpr;
  path: (string | number)[];
  varName: string | null;
  value_type: "continuous" | "categorical" | "text" | "list_strings" | null;
  isReference: boolean;
  isAllIntegers: boolean;
  isLoading: boolean;
}

// Changing the operator often has side effects on the rest expression.
// We have to make sure the operands remain valid.
const buildNextExpression = (
  prevOp: string,
  nextOp: string,
  lhs: RelationExpr[OperatorType][0],
  rhs: RelationExpr[OperatorType][1]
) => {
  // "is in context" — pseudo-operator, emits standard "in"
  if (nextOp === "in_context") {
    return {
      in: [lhs, isEmbeddedContextExpression(rhs) ? rhs : { context: null }],
    };
  }

  // Switching away from "is in context" — discard the context reference
  if (prevOp === "in_context") {
    return { [nextOp]: [lhs, null] };
  }

  // Null-check operators are unary — no rhs
  if (nextOp === "is_null" || nextOp === "not_null") {
    return { [nextOp]: [lhs] };
  }

  // Switching away from a null-check operator — rhs doesn't exist yet,
  // so supply null and let the UI prompt the user for a value
  if (prevOp === "is_null" || prevOp === "not_null") {
    return { [nextOp]: [lhs, null] };
  }

  // Switching from scalar to list operator — wrap rhs in array
  if (["==", "!="].includes(prevOp) && ["in", "!in"].includes(nextOp)) {
    return { [nextOp]: [lhs, typeof rhs === "string" ? [rhs] : null] };
  }

  // Switching from list to scalar operator — unwrap first element
  if (["in", "!in"].includes(prevOp) && ["==", "!="].includes(nextOp)) {
    return {
      [nextOp]: [lhs, Array.isArray(rhs) && rhs.length > 0 ? rhs[0] : null],
    };
  }

  // Simple operator swap, operands stay as-is
  return { [nextOp]: [lhs, rhs] };
};

function Operator({
  expr,
  path,
  varName,
  value_type,
  isReference,
  isAllIntegers,
  isLoading,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { dispatch, fullySpecifiedVars } = useContextBuilderState();

  const op = getOperator(expr);

  const options = useMemo(() => {
    if (!value_type) {
      return opLabels;
    }

    // References to other types can use these pseudo context operators.
    // They are not real operators but merely placeholders that the user
    // can select, which turns the rhs into a { "context": ... } expression.
    if (isReference) {
      return {
        // TODO: Add more operators like "has property", "does not have
        // property", etc
        in_context: "is in context",
      };
    }

    return Object.fromEntries(
      Object.entries(opLabels)
        .filter(([key]) => {
          return operatorsByValueType[value_type].has(key);
        })
        .filter(([key]) => {
          // Prevent users from using strict equality on floating point
          // numbers.
          if (value_type === "continuous" && !isAllIntegers) {
            return key !== "==" && key !== "!=";
          }

          return true;
        })
        .map(([val, label]) => {
          if (value_type === "continuous" && val === "==") {
            // Change the default label of "is" to "＝" (which makes more
            // sense with numbers).
            return [val, "＝"];
          }

          // Change the default label of "is not" to "≠" (which makes more
          // sense with  numbers).
          if (value_type === "continuous" && val === "!=") {
            return [val, "≠"];
          }

          return [val, label];
        })
    );
  }, [isAllIntegers, isReference, value_type]);

  let value = op as typeof op | "in_context";

  if (op === "in" && isReference) {
    value = "in_context";
  }

  return (
    <PlotConfigSelect
      show
      innerRef={ref}
      enable={!isLoading && !!varName && fullySpecifiedVars.has(varName)}
      isLoading={isLoading}
      className={cx(styles.Operator, {
        [styles.list]: isListOperator(op) && !isReference,
        [styles.unary]: isUnaryOperator(op),
        [styles.context]: isReference,
      })}
      placeholder=""
      value={isLoading ? null : value}
      options={options}
      onChange={(nextOp) => {
        const innerExpr = expr[op];
        const lhs = innerExpr[0];
        const rhs = innerExpr[1];

        dispatch({
          type: "update-value",
          payload: {
            path,
            value: buildNextExpression(op, nextOp!, lhs, rhs),
          },
        });

        scrollParentIntoView(ref.current);
      }}
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default Operator;
