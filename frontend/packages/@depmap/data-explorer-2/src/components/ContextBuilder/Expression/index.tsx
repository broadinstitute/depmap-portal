import React from "react";
import cx from "classnames";
import {
  isEditableAsCellLineList,
  isEmptyListExpr,
  getSelectedCellLines,
  useEvaluatedExpressionResult,
} from "./utils";
import AddConditionButton from "./AddConditionButton";
import DeleteConditionButton from "./DeleteConditionButton";
import EditInCellLineSelectorButton from "./EditInCellLineSelectorButton";
import Comparison from "../Comparison";
import { ContextBuilderReducerAction } from "../contextBuilderReducer";
import { getOperator, isBoolean, isComparison } from "../contextBuilderUtils";
import GroupExpr from "../GroupExpr";
import styles from "../../../styles/ContextBuilder.scss";

interface ExpressionProps {
  expr: any;
  path: (string | number)[];
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  slice_type: string;
  shouldShowValidation: boolean;
  isLastOfList?: boolean;
  editInCellLineSelector: (
    selections: string[],
    shouldUseModelNames: boolean
  ) => Promise<string[]>;
}

function Expression({
  expr,
  path,
  dispatch,
  slice_type,
  shouldShowValidation,
  isLastOfList = false,
  editInCellLineSelector,
}: ExpressionProps): React.ReactElement {
  const result = useEvaluatedExpressionResult(slice_type, expr);

  if (isBoolean(expr)) {
    return (
      <GroupExpr
        expr={expr}
        path={path}
        dispatch={dispatch}
        slice_type={slice_type}
        shouldShowValidation={shouldShowValidation}
        result={result}
        editInCellLineSelector={editInCellLineSelector}
        // We pass the Expression component as a prop (rather than
        // importing this module directly) to avoid a dependency cycle.
        Expression={Expression}
      />
    );
  }

  if (isComparison(expr)) {
    const numConditions = Number(path.slice().pop()) + 1;

    return (
      <div className={cx({ [styles.topLevelRule]: path.length < 3 })}>
        <div className={styles.comparisonExpr}>
          <Comparison
            expr={expr}
            path={path}
            dispatch={dispatch}
            slice_type={slice_type}
            shouldShowValidation={shouldShowValidation}
          />
          <div>
            <div>
              {isEditableAsCellLineList(slice_type, expr) && (
                <EditInCellLineSelectorButton
                  onClick={() => {
                    const op = getOperator(expr);
                    const shouldUseModelNames =
                      expr[op][0].var !== "entity_label";

                    editInCellLineSelector(
                      getSelectedCellLines(expr),
                      shouldUseModelNames
                    ).then((updatedList) => {
                      dispatch({
                        type: "update-value",
                        payload: {
                          path: [...path, op, 1],
                          value: updatedList,
                        },
                      });
                    });
                  }}
                />
              )}
              {path.length > 0 && (
                <DeleteConditionButton path={path} dispatch={dispatch} />
              )}
              {path.length > 0 && (path.length < 3 || isLastOfList) && (
                <AddConditionButton
                  path={path}
                  dispatch={dispatch}
                  numConditions={numConditions}
                />
              )}
            </div>
            {result && (
              <div
                className={styles.subexprResult}
                style={{ fontSize: result.num_matches > 999 ? 12 : 14 }}
              >
                {result.num_matches.toLocaleString()}
                {result.num_matches === 1 ? " match" : " matches"}
              </div>
            )}
          </div>
        </div>
        {isEmptyListExpr(expr) && (
          <div className={styles.listInputHint}>
            Hint: You can paste lists of values into the input above.
          </div>
        )}
      </div>
    );
  }

  return <div className={styles.Expression}>⚠️ Unknown expression</div>;
}

export default Expression;
