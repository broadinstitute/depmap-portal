import {
  DataExplorerContextV2,
  DataExplorerContextVariable,
} from "@depmap/types";

// Replaces UUIDs with integers. This isn't strictly necessary but it prevents
// otherwise identical contexts from being hashed differently.
function simplifyVarNames(context: DataExplorerContextV2) {
  const nextVars: Record<string, DataExplorerContextVariable> = {};
  let i = 0;

  const nextExpr = JSON.parse(
    JSON.stringify(context.expr, (key, value) => {
      if (key === "var") {
        const newVarName = `${i++}`;
        nextVars[newVarName] = context.vars[value];
        return newVarName;
      }

      return value;
    })
  );

  return {
    ...context,
    expr: nextExpr,
    vars: nextVars,
  };
}

export default simplifyVarNames;
