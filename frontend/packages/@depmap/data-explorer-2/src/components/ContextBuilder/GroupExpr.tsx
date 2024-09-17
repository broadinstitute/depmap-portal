import React, { useRef, useEffect } from "react";
import cx from "classnames";
import { get_values } from "json-logic-js";
import { getDimensionTypeLabel, pluralize } from "../../utils/misc";
import AnyAllSelect from "./AnyAllSelect";
import { getOperator } from "./contextBuilderUtils";
import styles from "../../styles/ContextBuilder.scss";

const MAX_CONDITIONS = 10;

function Result({ result, isTopLevel, slice_type }: any) {
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
}: any) {
  const container = useRef(null);
  const op = getOperator(expr);
  const isTopLevel = path.length === 0;
  const numConditions = get_values(expr).length;

  return (
    <div className={cx(styles.Group, { [styles.nestedGroup]: !isTopLevel })}>
      <AnyAllSelect path={path} value={op} dispatch={dispatch} />
      <div className={styles.groupExpr}>
        <div ref={container} className={cx({ [styles.mainExpr]: isTopLevel })}>
          {expr[op].map((subExpr: any, i: number) => (
            <div
              key={[...path, op, i].toString()}
              style={{ marginTop: i > 0 ? 10 : 0 }}
            >
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
