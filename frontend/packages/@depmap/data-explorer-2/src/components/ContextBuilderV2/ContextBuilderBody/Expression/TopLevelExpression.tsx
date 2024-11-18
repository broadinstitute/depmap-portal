import React from "react";
import { Button } from "react-bootstrap";
import { get_values } from "json-logic-js";
import { Expr, getOperator, MAX_CONDITIONS } from "../../utils/expressionUtils";
import { scrollLastConditionIntoView } from "../../utils/domUtils";
import { useContextBuilderState } from "../../state/ContextBuilderState";
import type { ExpressionComponentType } from "./index";
import BooleanExpression from "./BooleanExpression";
import NumberOfMatches from "./NumberOfMatches";
import styles from "../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: Record<"and" | "or", Expr[]>;
  Expression: ExpressionComponentType;
}

function TopLevelExpression({ expr, Expression }: Props) {
  const { dispatch } = useContextBuilderState();

  const op = getOperator(expr);
  const numConditions = get_values(expr).length;

  return (
    <div className={styles.TopLevelExpression}>
      <BooleanExpression
        expr={expr}
        path={[]}
        isTopLevel
        Expression={Expression}
      />
      <div className={styles.topLevelButtonsAndStats}>
        <Button
          id="add-condition"
          bsStyle="info"
          disabled={numConditions >= MAX_CONDITIONS}
          onClick={() => {
            dispatch({ type: "add-condition", payload: { path: [op] } });
            scrollLastConditionIntoView();
          }}
        >
          Add condition +
        </Button>
        <NumberOfMatches
          className={styles.topLevelMatches}
          showNumCandidates
          expr={expr}
        />
      </div>
    </div>
  );
}

export default TopLevelExpression;
