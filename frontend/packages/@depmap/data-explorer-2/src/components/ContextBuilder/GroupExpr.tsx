import React, { useRef, useEffect } from "react";
import cx from "classnames";
import { get_values } from "json-logic-js";
import { DeprecatedDataExplorerApiResponse } from "../../contexts/DeprecatedDataExplorerApiContext";
import { getDimensionTypeLabel, pluralize } from "../../utils/misc";
import AnyAllSelect from "./AnyAllSelect";
import { Expr, getOperator } from "./contextBuilderUtils";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import type { ExpressionComponentType } from "./Expression";
import styles from "../../styles/ContextBuilder.scss";

const MAX_CONDITIONS = 10;

interface Props {
  expr: Record<"and" | "or", Expr[]>;
  path: (string | number)[];
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  slice_type: string;
  shouldShowValidation: boolean;
  result: DeprecatedDataExplorerApiResponse["fetchContextSummary"] | null;
  editInCellLineSelector: (
    modelNamesOrIDs: string[],
    shouldUseModelNames: boolean
  ) => Promise<string[]>;
  Expression: ExpressionComponentType;
}

function Result({
  result,
  isTopLevel,
  slice_type,
}: {
  result: DeprecatedDataExplorerApiResponse["fetchContextSummary"];
  isTopLevel: boolean;
  slice_type: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  return (
    <div
      className={styles.groupExprResult}
      ref={ref}
      style={{ scrollMargin: 24 }}
    >
      {!isTopLevel && <span className={styles.groupExprResultSeparator} />}
      <div className={styles.groupExprResultValue}>
        {isTopLevel && result.num_matches === 0 && (
          <div className={styles.noMatchesError}>
            These conditions produce no matches. Please double-check them.
          </div>
        )}
        {isTopLevel ? (
          <>
            <span>
              <b>{result.num_matches.toLocaleString()}</b>
            </span>
            <span>of {result.num_candidates.toLocaleString()}</span>
            <span>{pluralize(getDimensionTypeLabel(slice_type))}</span>
          </>
        ) : (
          <>
            {result.num_matches.toLocaleString()}
            {result.num_matches === 1 ? " match" : " matches"}
          </>
        )}
      </div>
    </div>
  );
}

function GroupExpr({
  expr,
  path,
  dispatch,
  slice_type,
  shouldShowValidation,
  result,
  editInCellLineSelector,
  Expression,
}: Props) {
  const container = useRef(null);
  const op = getOperator(expr) as "and" | "or";
  const isTopLevel = path.length === 0;
  const numConditions = get_values(expr).length;

  return (
    <div className={cx(styles.Group, { [styles.nestedGroup]: !isTopLevel })}>
      <AnyAllSelect path={path} value={op} dispatch={dispatch} />
      <div className={styles.groupExpr}>
        <div ref={container} className={cx({ [styles.mainExpr]: isTopLevel })}>
          {expr[op].map((subExpr, i: number) => (
            <div key={[...path, op, i].toString()} style={{ marginTop: 20 }}>
              <Expression
                expr={subExpr}
                path={[...path, op, i]}
                dispatch={dispatch}
                slice_type={slice_type}
                shouldShowValidation={shouldShowValidation}
                isLastOfList={i === expr[op].length - 1}
                editInCellLineSelector={editInCellLineSelector}
              />
            </div>
          ))}
        </div>
        {expr[op].length === 0 && shouldShowValidation && (
          <p className={styles.invalidEmptyExpression}>
            Please add at least one condition.
          </p>
        )}
        <div className={styles.groupSummary}>
          {isTopLevel ? (
            <button
              id="add-condition"
              type="button"
              className={styles.addButton}
              onClick={() => {
                dispatch({
                  type: "add-condition",
                  payload: { path: [...path, op] },
                });
              }}
              disabled={numConditions >= MAX_CONDITIONS}
            >
              + add condition
            </button>
          ) : (
            <div />
          )}
          {result && (
            <Result
              result={result}
              isTopLevel={isTopLevel}
              slice_type={slice_type}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupExpr;
