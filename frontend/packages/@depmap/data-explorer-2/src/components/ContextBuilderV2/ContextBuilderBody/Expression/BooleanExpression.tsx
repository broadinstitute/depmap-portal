import React from "react";
import cx from "classnames";
import type { ExpressionComponentType } from "./index";
import { Expr, getOperator } from "../../utils/expressionUtils";
import AnyAllToggle from "./AnyAllToggle";
import NumberOfMatches from "./NumberOfMatches";
import styles from "../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: Record<"and" | "or", Expr[]>;
  path: (string | number)[];
  Expression: ExpressionComponentType;
  isTopLevel?: boolean;
}

function BooleanExpression({
  expr,
  path,
  Expression,
  isTopLevel = false,
}: Props) {
  const op = getOperator(expr) as "and" | "or";
  const subexpressions = expr[op];

  return (
    <div className={styles.BooleanExpression}>
      <AnyAllToggle value={op} path={path} />
      <div className={styles.boolSubexpressions}>
        {subexpressions.length === 0 && (
          <div className={styles.zeroConditionsWarning}>
            Please add at least one rule.
          </div>
        )}
        {subexpressions.map((subExpr, i) => (
          <div
            className={cx(styles.boolSubexpr, {
              [styles.isTopLevel]: isTopLevel,
            })}
            key={[...path, op, i].toString()}
            data-expr-scroll-index={isTopLevel ? i : false}
          >
            <Expression
              expr={subExpr}
              path={[...path, op, i]}
              isLastOfList={i === expr[op].length - 1}
            />
          </div>
        ))}
      </div>
      {!isTopLevel && subexpressions.length > 1 && (
        <div className={styles.boolExprResult}>
          <div className={styles.boolExprResultLine} />
          <NumberOfMatches
            className={styles.subexpressionMatches}
            expr={expr}
            isGroupTotal
          />
        </div>
      )}
    </div>
  );
}

export default BooleanExpression;
