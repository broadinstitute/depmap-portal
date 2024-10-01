/* eslint-disable @typescript-eslint/no-explicit-any */
import get from "lodash.get";
import setWith from "lodash.setwith";
import clone from "lodash.clone";

type Expr = Record<string, any>;
type Path = (string | number)[];

export type ContextBuilderReducerAction =
  | { type: "update-value"; payload: { path: Path; value: any } }
  | { type: "update-bool-op"; payload: { path: Path; value: "and" | "or" } }
  | { type: "add-condition"; payload: { path: Path } }
  | { type: "convert-to-group"; payload: { path: Path } }
  | { type: "delete-condition"; payload: { path: Path } };

const emptyExpr: Expr = { "==": [null, null] };

// An immutable setter function
// See https://github.com/lodash/lodash/issues/1696#issuecomment-328335502
const set = (object: any, path: Path, value: any): any => {
  return path.length === 0 ? value : setWith(clone(object), path, value, clone);
};

function contextBuilderReducer(
  expr: Expr,
  action: ContextBuilderReducerAction
) {
  const { path } = action.payload;

  switch (action.type) {
    case "update-value": {
      const { value } = action.payload;

      if (value?.var) {
        // When the lhs of a comparison changes, also make sure to erase the
        // rhs.
        const parentPath = path.slice(0, -1);
        const nextSubExpr = [value, undefined];

        // TODO: The variable's type might not match the current operator at
        // the grandparent path. We might have to set that back to '==' too.
        return set(expr, parentPath, nextSubExpr);
      }

      return set(expr, path, value);
    }

    case "update-bool-op": {
      const { value } = action.payload;
      const subexpr = get(expr, path) || expr;
      const list = subexpr.and || subexpr.or;
      return set(expr, path, { [value]: list });
    }

    case "add-condition": {
      const concatExpr = [...get(expr, path), emptyExpr];
      return set(expr, path, concatExpr);
    }

    case "convert-to-group": {
      const subexpr = get(expr, path);
      const op = expr.and ? "or" : "and";
      const nextSubExpr = { [op]: [subexpr, emptyExpr] };
      return set(expr, path, nextSubExpr);
    }

    case "delete-condition": {
      let parentPath = path.slice(0, -1);
      const removeIndex = path.slice(-1).pop();
      const parentExpr = get(expr, parentPath);

      let nextParentExpr = parentExpr.filter(
        (_: any, i: number) => i !== removeIndex
      );

      if (path.length > 2 && nextParentExpr.length === 1) {
        parentPath = parentPath.slice(0, -1);
        [nextParentExpr] = nextParentExpr;
      }

      if (path.length > 2 && nextParentExpr.length === 0) {
        parentPath = parentPath.slice(0, -2);
        nextParentExpr = get(expr, parentPath).slice(0, -1);
      }

      return set(expr, parentPath, nextParentExpr);
    }

    default:
      return expr;
  }
}

export default contextBuilderReducer;
