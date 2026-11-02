// This module is part of the standalone Node bundle (see
// embed-frontend/webpack.node.js), so keep it free of storage and `window`.
import type { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";

export const isContextAll = (
  context: DataExplorerContext | DataExplorerContextV2
) => {
  // `true` is a special value used to match on anything.
  return Boolean(context) && context.expr === true;
};

export function isV2Context(
  context: DataExplorerContext | DataExplorerContextV2
): context is DataExplorerContextV2 {
  return "dimension_type" in context;
}

// https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads
// prettier-ignore
export function negateContext(context: DataExplorerContext): DataExplorerContext;
// prettier-ignore
export function negateContext(context: DataExplorerContextV2): DataExplorerContextV2;
export function negateContext(
  context: DataExplorerContext | DataExplorerContextV2
) {
  const name = context.name.startsWith("Not ")
    ? context.name.slice(4)
    : `Not ${context.name}`;

  const prevExpr = context.expr as any;
  const expr = prevExpr.complement
    ? prevExpr.complement
    : { complement: prevExpr };

  if (isV2Context(context)) {
    return {
      name,
      dimension_type: context.dimension_type,
      expr,
      vars: context.vars,
      ...(context.contexts ? { contexts: context.contexts } : null),
    };
  }

  return {
    name,
    context_type: context.context_type,
    expr,
  };
}
