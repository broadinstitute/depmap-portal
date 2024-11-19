import React, { useEffect } from "react";
import {
  getOperator,
  makeCompatibleExpression,
  RelationExpr,
} from "../../../utils/expressionUtils";
import { useContextBuilderState } from "../../../state/ContextBuilderState";
import useDomain from "../../../hooks/useDomain";
import Variable from "./Variable";
import Operator from "./Operator";
import RightHandSide from "./RightHandSide";
import ButtonsAndStats from "./ButtonsAndStats";
import styles from "../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: RelationExpr;
  path: (string | number)[];
  isLastOfList: boolean;
}

function RelationalExpression({ expr, path, isLastOfList }: Props) {
  const op = getOperator(expr);
  const [left, right] = expr[op];
  const varName = left?.var || null;
  const leftPath = [...path, op, 0];
  const rightPath = [...path, op, 1];

  const { dispatch } = useContextBuilderState();
  const { isLoading, domain } = useDomain(varName);

  useEffect(() => {
    const nextExpr = makeCompatibleExpression(expr, domain);

    if (expr !== nextExpr) {
      dispatch({
        type: "update-value",
        payload: { path, value: nextExpr },
      });
    }
    // Only initialize the value when the domain changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  return (
    <div className={styles.RelationalExpression}>
      <Variable expr={left} path={leftPath} />
      <Operator
        expr={expr}
        path={path}
        varName={varName}
        isLoading={isLoading}
      />
      <div className={styles.rhsWrapper}>
        <RightHandSide
          op={op}
          expr={right}
          path={rightPath}
          varName={varName}
          isLoading={isLoading}
          domain={domain}
        />
        <ButtonsAndStats
          expr={expr}
          path={path}
          varName={varName}
          isLastOfList={isLastOfList}
        />
      </div>
    </div>
  );
}

export default RelationalExpression;
