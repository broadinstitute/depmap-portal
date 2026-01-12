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
  TabularDataset,
} from "@depmap/types";
import { isCompleteExpression } from "../../../utils/misc";
import { Expr, isBoolean, flattenExpr } from "../utils/expressionUtils";
import simplifyVarNames from "../utils/simplifyVarNames";
import useInitializer from "./useInitializer";
import expressionReducer, { ExprReducerAction } from "./expressionReducer";

export const DEFAULT_EMPTY_EXPR = { and: [{ "==": [null, null] }] };

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
  initializationError: false,
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
  replaceExprWithSimpleList: (() => {}) as (ids: string[]) => void,
  isManualSelectMode: false,
  undoManualSelectionMode: (() => {}) as () => void,
  metadataDataset: undefined as TabularDataset | undefined,
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
  startInTableView,
  children,
}: {
  contextToEdit: Partial<DataExplorerContextV2>;
  onChangeContext: (nextContext: DataExplorerContextV2) => void;
  startInTableView: boolean;
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

  const {
    isInitializing,
    initializationError,
    metadataDataset,
    metadataIdColumn,
  } = useInitializer(
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

  const lastValidExpressionRef = useRef<Expr>(DEFAULT_EMPTY_EXPR);
  const lastValidVars = useRef<typeof vars>({});

  useEffect(() => {
    if (isCompleteExpression(mainExpr)) {
      lastValidExpressionRef.current = mainExpr;
    } else if (mainExpr?.and?.length === 0 || mainExpr?.or?.length === 0) {
      lastValidExpressionRef.current = DEFAULT_EMPTY_EXPR;
    }
  }, [mainExpr]);

  useEffect(() => {
    if (
      Object.keys(vars).length > 0 &&
      Object.keys(vars).every((varName) => fullySpecifiedVars.has(varName))
    ) {
      lastValidVars.current = vars;
    }
  }, [vars, fullySpecifiedVars]);

  const [showTableView, setShowTableView] = useState(startInTableView);
  const [tableOnlySlices, setTableOnlySlices] = useState<SliceQuery[]>([]);

  // When switching to table view, thow out any incomplete rules.
  useEffect(() => {
    if (
      showTableView &&
      !isCompleteExpression(mainExpr) &&
      lastValidExpressionRef.current &&
      lastValidVars.current
    ) {
      dispatch({
        type: "update-value",
        payload: {
          path: [],
          value: lastValidExpressionRef.current as Expr,
        },
      });

      setVars(lastValidVars.current);
    }
  }, [mainExpr, showTableView]);

  const uniqueVariableSlices = useMemo(() => {
    const jsonSlices = [...fullySpecifiedVars].map((varName) => {
      const { dataset_id, identifier, identifier_type, slice_type } = vars[
        varName
      ];

      let resolvedIdType = identifier_type;

      // Edge case: for `null` feature types, the id and label are the
      // same so we want to consider the slices to be equivalent as well.
      if (slice_type === null) {
        resolvedIdType = "feature_id";
      }

      return JSON.stringify({
        dataset_id,
        identifier,
        identifier_type: resolvedIdType,
      });
    });

    return [...new Set(jsonSlices)].map((s) => JSON.parse(s) as SliceQuery);
  }, [fullySpecifiedVars, vars]);

  const [isReadyToSave, setIsReadyToSave] = useState(false);

  const manualModeRestorePoint = useRef({
    expr: null as Expr | null,
    prevVars: null as typeof vars | null,
    prevTableOnlySlices: tableOnlySlices,
  });

  const replaceExprWithSimpleList = useCallback(
    (ids: string[]) => {
      // Create a single manual list if one does not already exists...
      if (
        !("list" in vars) ||
        Object.keys(vars).length > 1 ||
        vars.list.identifier !== metadataIdColumn
      ) {
        setTableOnlySlices((prev) => {
          manualModeRestorePoint.current = {
            expr: lastValidExpressionRef.current,
            prevVars: lastValidVars.current,
            prevTableOnlySlices: prev,
          };

          const combined = new Set([...prev, ...uniqueVariableSlices]);
          return [...combined];
        });

        dispatch({
          type: "update-value",
          payload: {
            path: [],
            value: { and: [{ in: [{ var: "list" }, ids] }] },
          },
        });

        setVars({
          list: {
            dataset_id: metadataDataset!.given_id || metadataDataset!.id,
            identifier_type: "column",
            identifier: metadataIdColumn,
            source: "property",
          },
        });
        // ...otherwise update it
      } else {
        dispatch({
          type: "update-value",
          payload: {
            path: ["and", 0, "in", 1],
            value: ids,
          },
        });
      }
    },
    [metadataDataset, metadataIdColumn, setVars, uniqueVariableSlices, vars]
  );

  const isManualSelectMode =
    "list" in vars &&
    Object.keys(vars).length === 1 &&
    vars.list.identifier === metadataIdColumn &&
    Boolean(
      manualModeRestorePoint.current.expr &&
        manualModeRestorePoint.current.expr !== DEFAULT_EMPTY_EXPR
    );

  const undoManualSelectionMode = useCallback(() => {
    const {
      expr,
      prevVars,
      prevTableOnlySlices,
    } = manualModeRestorePoint.current;

    if (expr && prevVars) {
      dispatch({ type: "update-value", payload: { path: [], value: expr } });
      setVars(prevVars);
    }

    setTableOnlySlices(prevTableOnlySlices);
  }, []);

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
        initializationError,
        isEmptyExpression,
        showTableView,
        setShowTableView,
        tableOnlySlices,
        setTableOnlySlices,
        uniqueVariableSlices,
        isReadyToSave,
        setIsReadyToSave,
        replaceExprWithSimpleList,
        isManualSelectMode,
        undoManualSelectionMode,
        dimension_type: contextToEdit.dimension_type as string,
        metadataDataset,
      }}
    >
      {children}
    </ContextBuilderState.Provider>
  );
};
