import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  DataExplorerContextExpression,
  DataExplorerContextV2,
  DataExplorerContextVariable,
  isValidSliceQuery,
  SliceQuery,
} from "@depmap/types";
import { isCompleteExpression } from "../../../utils/misc";
import { Expr, isBoolean, flattenExpr } from "../utils/expressionUtils";
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
  isEmptyExpression: false,
  showTableView: false,
  setShowTableView: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
  tableOnlySlices: [] as SliceQuery[],
  setTableOnlySlices: (() => {}) as React.Dispatch<
    React.SetStateAction<SliceQuery[]>
  >,
  uniqueVariableSlices: [] as SliceQuery[],
  isReadyToSave: false,
  setIsReadyToSave: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
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
    vars,
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
      name: name as string,
      dimension_type: contextToEdit.dimension_type as string,
      expr: flattenExpr(mainExpr) as DataExplorerContextExpression,
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

  const isEmptyExpression = useMemo(() => {
    if (Object.keys(mainExpr).length === 1) {
      const key = Object.keys(mainExpr)[0];
      return Array.isArray(mainExpr[key]) && mainExpr[key].length === 0;
    }

    return false;
  }, [mainExpr]);

  const lastValidExpressionRef = useRef<Expr | null>(null);

  useEffect(() => {
    if (isCompleteExpression(mainExpr)) {
      lastValidExpressionRef.current = mainExpr;
    }
  }, [mainExpr]);

  const [showTableView, setShowTableView] = useState(false);
  const [tableOnlySlices, setTableOnlySlices] = useState<SliceQuery[]>([]);

  useEffect(() => {
    if (
      showTableView &&
      !isCompleteExpression(mainExpr) &&
      lastValidExpressionRef.current
    ) {
      dispatch({
        type: "update-value",
        payload: {
          path: [],
          value: lastValidExpressionRef.current as Expr,
        },
      });
    }
  }, [mainExpr, showTableView]);

  const uniqueVariableSlices = useMemo(() => {
    const jsonSlices = [...fullySpecifiedVars].map((varName) => {
      const { dataset_id, identifier, identifier_type } = vars[varName];
      return JSON.stringify({
        dataset_id,
        identifier,
        identifier_type,
      });
    });

    return [...new Set(jsonSlices)].map((s) => JSON.parse(s) as SliceQuery);
  }, [fullySpecifiedVars, vars]);

  const [isReadyToSave, setIsReadyToSave] = useState(false);

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
        isEmptyExpression,
        showTableView,
        setShowTableView,
        tableOnlySlices,
        setTableOnlySlices,
        uniqueVariableSlices,
        isReadyToSave,
        setIsReadyToSave,
        dimension_type: contextToEdit.dimension_type as string,
      }}
    >
      {children}
    </ContextBuilderState.Provider>
  );
};
