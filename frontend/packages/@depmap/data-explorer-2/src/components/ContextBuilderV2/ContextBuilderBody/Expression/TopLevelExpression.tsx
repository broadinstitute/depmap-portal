import React, { useEffect } from "react";
import { Button } from "react-bootstrap";
import { get_values } from "json-logic-js";
import { Expr, getOperator, MAX_CONDITIONS } from "../../utils/expressionUtils";
import {
  scrollLastConditionIntoView,
  saveScrollPosition,
  restoreScrollPosition,
} from "../../utils/domUtils";
import { useContextBuilderState } from "../../state/ContextBuilderState";
import type { ExpressionComponentType } from "./index";
import BooleanExpression from "./BooleanExpression";
import NumberOfMatches from "./NumberOfMatches";
import useMatches from "../../hooks/useMatches";
import styles from "../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: Record<"and" | "or", Expr[]>;
  Expression: ExpressionComponentType;
}

function TopLevelExpression({ expr, Expression }: Props) {
  useEffect(
    () => restoreScrollPosition(expr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      /* only do this on mount */
    ]
  );

  const {
    dispatch,
    setShowTableView,
    setIsReadyToSave,
  } = useContextBuilderState();

  const { isLoading, numMatches } = useMatches(expr);

  useEffect(() => {
    if (isLoading) {
      setIsReadyToSave(false);
    } else {
      setIsReadyToSave(numMatches !== null && numMatches > 0);
    }
  }, [isLoading, numMatches, setIsReadyToSave]);

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
        <div className={styles.tlButtons}>
          <Button
            id="add-condition"
            bsStyle="info"
            disabled={numConditions >= MAX_CONDITIONS}
            onClick={() => {
              dispatch({ type: "add-condition", payload: { path: [op] } });
              scrollLastConditionIntoView();
            }}
          >
            <i className="glyphicon glyphicon-plus" />
            <span> Add rule</span>
          </Button>
          <Button
            onClick={() => {
              saveScrollPosition(expr);
              setShowTableView(true);
            }}
          >
            <i className="glyphicon glyphicon-th-list" />
            <span> View as table</span>
          </Button>
        </div>
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
