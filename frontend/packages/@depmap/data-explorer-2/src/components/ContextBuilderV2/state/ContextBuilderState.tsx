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
});

export const useContextBuilderState = () => {
  return useContext(ContextBuilderState);
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
    contextToEdit.expr || DEFAULT_EMPTY_EXPR
  );

  const setVar = useCallback(
    (key: string, value: Partial<DataExplorerContextVariable>) => {
      setVars((prev) => ({ ...prev, [key]: value }));
    },
    []
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

    onChangeContext({
      name,
      dimension_type: contextToEdit.dimension_type as string,
      expr: mainExpr,
      vars: vars as Record<string, DataExplorerContextVariable>,
    });
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
        dimension_type: contextToEdit.dimension_type as string,
      }}
    >
      {children}
    </ContextBuilderState.Provider>
  );
};