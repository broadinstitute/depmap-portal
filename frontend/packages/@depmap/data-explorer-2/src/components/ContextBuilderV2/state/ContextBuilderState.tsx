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
import {
  Expr,
  isBoolean,
  flattenExpr,
  getContextNames,
} from "../utils/expressionUtils";
import simplifyVarNames from "../utils/simplifyVarNames";
import { contextToReindexChains } from "../utils/contextChains";
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
  embeddedContexts: {} as Record<string, DataExplorerContextV2>,
  setEmbeddedContext: (key: string, value: DataExplorerContextV2) => {
    window.console.log("setEmbeddedContext", { key, value });
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

  const [embeddedContexts, setEmbeddedContexts] = useState<
    Record<string, DataExplorerContextV2>
  >(contextToEdit.contexts || {});

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

  const deleteVar = useCallback((keyToRemove: string) => {
    setVars((prev) => {
      const { [keyToRemove]: _, ...next } = prev;
      return next;
    });
  }, []);

  const setEmbeddedContext = useCallback(
    (key: string, value: DataExplorerContextV2) => {
      setEmbeddedContexts((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Purge embedded contexts that are no longer referenced in the expression.
  // Bail out early when nothing would actually be filtered so we preserve
  // the object reference — this avoids churning downstream memos that now
  // depend on `embeddedContexts` (notably `uniqueVariableSlices`).
  useEffect(() => {
    const referencedNames = new Set(getContextNames(mainExpr));

    setEmbeddedContexts((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => referencedNames.has(k))) {
        return prev;
      }
      return Object.fromEntries(
        Object.entries(prev).filter(([key]) => referencedNames.has(key))
      );
    });
  }, [mainExpr]);

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

    if (Object.keys(embeddedContexts).length > 0) {
      nextContext.contexts = embeddedContexts;
    }

    onChangeContext(nextContext);
  }, [
    contextToEdit,
    fullySpecifiedVars,
    mainExpr,
    onChangeContext,
    name,
    vars,
    embeddedContexts,
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

  // When switching to table view, throw out any incomplete rules.
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

  // Step 1: produce a canonical serialized form. This recomputes whenever
  // the inputs change, but it produces a primitive string — so the next
  // memo only re-runs when the *content* is actually different.
  const uniqueVariableSlicesKey = useMemo(() => {
    const completeVars = Object.fromEntries(
      [...fullySpecifiedVars].map((k) => [k, vars[k]])
    ) as Record<string, DataExplorerContextVariable>;

    const chains = contextToReindexChains({
      expr: mainExpr as DataExplorerContextV2["expr"],
      vars: completeVars,
      contexts: embeddedContexts,
    });

    const seen = new Set<string>();
    for (const chain of chains) {
      seen.add(JSON.stringify(chain));
    }
    return [...seen].sort().join("\n");
  }, [fullySpecifiedVars, vars, mainExpr, embeddedContexts]);

  // Step 2: parse back into SliceQuery[]. Depends only on the string key,
  // so when mainExpr dispatches produce structurally-identical chains,
  // this memo returns its previous (referentially stable) array.
  const uniqueVariableSlices = useMemo<SliceQuery[]>(() => {
    if (!uniqueVariableSlicesKey) return [];
    return uniqueVariableSlicesKey
      .split("\n")
      .map((s) => JSON.parse(s) as SliceQuery);
  }, [uniqueVariableSlicesKey]);

  const [isReadyToSave, setIsReadyToSave] = useState(false);

  const manualModeRestorePoint = useRef({
    expr: null as Expr | null,
    prevVars: null as typeof vars | null,
    prevEmbeddedContexts: null as Record<string, DataExplorerContextV2> | null,
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
            prevEmbeddedContexts: embeddedContexts,
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
    [
      embeddedContexts,
      metadataDataset,
      metadataIdColumn,
      setVars,
      uniqueVariableSlices,
      vars,
    ]
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
      prevEmbeddedContexts,
      prevTableOnlySlices,
    } = manualModeRestorePoint.current;

    if (expr && prevVars) {
      dispatch({ type: "update-value", payload: { path: [], value: expr } });
      setVars(prevVars);
      // Restore embedded contexts alongside the expression. The purge
      // effect cleared them when we entered manual-mode (the list expr
      // has no context refs), so without this the restored expression
      // would reference context hashes that no longer exist.
      if (prevEmbeddedContexts) {
        setEmbeddedContexts(prevEmbeddedContexts);
      }
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
        embeddedContexts,
        setEmbeddedContext,
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
