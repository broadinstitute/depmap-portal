import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  DataExplorerContextV2,
  DataExplorerContextVariable,
  isValidSliceQuery,
} from "@depmap/types";
import { isCompleteExpression } from "../../../utils/misc";
import { Expr, isBoolean } from "../utils/expressionUtils";
import simplifyVarNames from "../utils/simplifyVarNames";
import useInitializer from "./useInitializer";
import expressionReducer, { ExprReducerAction } from "./expressionReducer";

const DEFAULT_EMPTY_EXPR = { and: [{ "==": [null, null] }] };

const ContextBuilderState = createContext({
  name: "",
  dimension_type: "depmap_model",
  onChangeName: (nextName: string) => {
    window.console.log("onChangeName", { nextName });
  },
  mainExpr: DEFAULT_EMPTY_EXPR,
  vars: {} as Record<string, Partial<DataExplorerContextVariable>>,
  fullySpecifiedVars: new Set([] as string[]),
  setVar: (key: string, value: Partial<DataExplorerContextVariable>) => {
    window.console.log("setVar", { key, value });
  },
  deleteVar: (keyToRemove: string) => {
    window.console.log("deleteVar", { keyToRemove });
  },
  dispatch: (() => {}) as React.Dispatch<ExprReducerAction>,
  onClickSave: () => {},
  shouldShowValidation: false,
  isInitializing: false,
});

export const useContextBuilderState = () => {
  return useContext(ContextBuilderState);
};

// HACK: The UI behaves oddly if we don't have an array at the top level.
const toTopLevelBooleanExpr = (expr: DataExplorerContextV2["expr"]) => {
  return isBoolean(expr as Expr) ? expr : { and: [expr] };
};

export const ContextBuilderStateProvider = ({
  contextToEdit,
  onChangeContext,
  children,
}: {
  contextToEdit: Partial<DataExplorerContextV2>;
  onChangeContext: (nextContext: DataExplorerContextV2) => void;
  children: React.ReactNode;
}) => {
  const [name, onChangeName] = useState(contextToEdit.name || "");
  const [vars, setVars] = useState<
    Record<string, Partial<DataExplorerContextVariable>>
  >(contextToEdit.vars || {});
  const [shouldShowValidation, setShouldShowValidation] = useState(false);
  const [mainExpr, dispatch] = useReducer(
    expressionReducer,
    toTopLevelBooleanExpr(contextToEdit.expr || DEFAULT_EMPTY_EXPR)
  );

  const setVar = useCallback(
    (key: string, value: Partial<DataExplorerContextVariable>) => {
      setVars((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const isInitializing = useInitializer(
    mainExpr,
    contextToEdit.dimension_type!,
    setVar,
    dispatch
  );

  const deleteVar = useCallback((keyToRemove: string) => {
    setVars((prev) => {
      const { [keyToRemove]: _, ...next } = prev;
      return next;
    });
  }, []);

  const fullySpecifiedVars = useMemo(
    () =>
      new Set(
        Object.keys(vars).filter((varName) => isValidSliceQuery(vars[varName]))
      ),
    [vars]
  );

  const onClickSave = useCallback(() => {
    setShouldShowValidation(true);

    if (
      !name ||
      !isCompleteExpression(mainExpr) ||
      Object.keys(vars).length !== fullySpecifiedVars.size
    ) {
      return;
    }

    const nextContext = simplifyVarNames({
      name,
      dimension_type: contextToEdit.dimension_type as string,
      expr: mainExpr,
      vars: vars as Record<string, DataExplorerContextVariable>,
    });

    onChangeContext(nextContext);
  }, [
    contextToEdit,
    fullySpecifiedVars,
    mainExpr,
    onChangeContext,
    name,
    vars,
  ]);

  return (
    <ContextBuilderState.Provider
      value={{
        name,
        onChangeName,
        mainExpr,
        vars,
        setVar,
        deleteVar,
        fullySpecifiedVars,
        dispatch,
        shouldShowValidation,
        onClickSave,
        isInitializing,
        dimension_type: contextToEdit.dimension_type as string,
      }}
    >
      {children}
    </ContextBuilderState.Provider>
  );
};
