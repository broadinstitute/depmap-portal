import React from "react";
import { Expr, isBoolean, isRelation } from "../../utils/expressionUtils";
import TopLevelExpression from "./TopLevelExpression";
import BooleanExpression from "./BooleanExpression";
import RelationalExpression from "./RelationalExpression";

interface Props {
  expr: Expr;
  path: (string | number)[];
  isLastOfList?: boolean;
}

function Expression({ expr, path, isLastOfList = false }: Props) {
  if (isBoolean(expr)) {
    if (path.length === 0) {
      return <TopLevelExpression expr={expr} Expression={Expression} />;
    }

    return (
      <BooleanExpression expr={expr} path={path} Expression={Expression} />
    );
  }

  if (isRelation(expr)) {
    return (
      <RelationalExpression
        expr={expr}
        path={path}
        isLastOfList={isLastOfList}
      />
    );
  }

  return <div>⚠️ Unknown expression</div>;
}

export type ExpressionComponentType = typeof Expression;

export default Expression;
