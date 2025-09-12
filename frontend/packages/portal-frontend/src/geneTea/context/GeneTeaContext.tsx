import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { SortOption } from "../types";
import promptForSelectionFromContext from "../components/promptForSelectionFromContext";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { saveNewContext } from "src";
import { DataExplorerContext } from "@depmap/types";

// TODO organize this file a little better...
export const TERM_OPTIONS_FILTER_DEFAULTS = {
  sortBy: "Effect Size",
  maxTopTerms: 10,
  maxFDR: 0.05,
  effectSizeThreshold: 0.1,
  minMatchingQuery: 2,
  maxMatchingOverall: 5373,
};

export interface GeneTeaContextType {
  effectSizeThreshold: number;
  handleSetEffectSizeThreshold: (v: any) => void;
  minMatchingQuery: number;
  handleSetMinMatchingQuery: (v: any) => void;
  maxMatchingOverall: number | null;
  handleSetMaxMatchingOverall: (v: any) => void;
  maxTopTerms: number | null;
  handleSetMaxTopTerms: (v: any) => void;
  maxFDR: number;
  handleSetMaxFDR: (v: number) => void;
  doGroupTerms: boolean;
  handleSetDoGroupTerms: (v: boolean) => void;
  doClusterGenes: boolean;
  handleSetDoClusterGenes: (v: boolean) => void;
  doClusterTerms: boolean;
  handleSetDoClusterTerms: (v: boolean) => void;
  sortBy: SortOption;
  handleSetSortBy: (v: SortOption) => void;
  selectedTableRows: Set<string>;
  handleSetSelectedTableRows: (v: Set<string>) => void;
  geneSymbolSelections: Set<string>;
  handleSetGeneSymbolSelections: (v: any) => void;
  validGeneSymbols: Set<string>;
  handleSetValidGeneSymbols: (v: Set<string>) => void;
  inValidGeneSymbols: Set<string>;
  handleSetInValidGeneSymbols: (v: Set<string>) => void;
  allAvailableGenes: Set<string>;
  handleSetAllAvailableGenes: (v: Set<string>) => void;
  handleSetSelectionFromContext: () => Promise<void>;
  handleClearSelectedTableRows: () => void;
  selectedPlotGenes: Set<string>;
  handleSetPlotSelectedGenes: (
    selections: Set<string>,
    shiftKey: boolean
  ) => void;
  handleClickSavePlotSelectionAsContext: () => void;
  handleClearPlotSelection: () => void;
  isLoading: boolean;
  handleSetIsLoading: (v: boolean) => void;
  error: boolean;
  handleSetError: (v: boolean) => void;
  errorMessage: string;
  handleSetErrorMessage: (v: string) => void;
}

export const GeneTeaContext = createContext<GeneTeaContextType | undefined>(
  undefined
);

interface GeneTeaContextProviderProps {
  children: ReactNode;
}

export function GeneTeaContextProvider({
  children,
}: GeneTeaContextProviderProps) {
  const [error, setError] = useState(false);
  const handleSetError = useCallback((v: boolean) => setError(v), []);

  const [errorMessage, setErrorMessage] = useState<string>(
    "There was an error fetching data."
  );
  const handleSetErrorMessage = useCallback(
    (v: string) => setErrorMessage(v),
    []
  );

  const [isLoading, setIsLoading] = useState(false);
  const handleSetIsLoading = useCallback((v: boolean) => setIsLoading(v), []);

  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set()
  );
  const handleSetSelectedTableRows = useCallback(
    (v: Set<string>) => setSelectedTableRows(v),
    []
  );
  const handleClearSelectedTableRows = useCallback(
    () => setSelectedTableRows(new Set([])),
    []
  );

  const [doGroupTerms, setDoGroupTerms] = useState<boolean>(true);
  const handleSetDoGroupTerms = useCallback(
    (v: boolean) => setDoGroupTerms(v),
    []
  );

  const [doClusterGenes, setDoClusterGenes] = useState<boolean>(true);
  const handleSetDoClusterGenes = useCallback(
    (v: boolean) => setDoClusterGenes(v),
    []
  );

  const [doClusterTerms, setDoClusterTerms] = useState<boolean>(true);
  const handleSetDoClusterTerms = useCallback(
    (v: boolean) => setDoClusterTerms(v),
    []
  );

  const [sortBy, setSortBy] = useState<SortOption>(
    TERM_OPTIONS_FILTER_DEFAULTS.sortBy as SortOption
  );
  const handleSetSortBy = useCallback((v: SortOption) => setSortBy(v), []);

  const [geneSymbolSelections, setGeneSymbolSelections] = useState<Set<string>>(
    new Set(["CAD", "UMPS", "ADSL", "DHODH"])
  );
  const handleSetGeneSymbolSelections = useCallback(
    (v: any) => {
      setGeneSymbolSelections((prevVal: Set<string>) => {
        const nextState = typeof v === "function" ? v(prevVal) : v;

        if (prevVal !== nextState) {
          // Invalidate the table selections if the user searches on a different list
          // of gene symbols.
          handleClearSelectedTableRows();
        }
        return nextState;
      });
    },
    [handleClearSelectedTableRows]
  );

  const [validGeneSymbols, setValidGeneSymbols] = useState<Set<string>>(
    new Set([])
  );
  const handleSetValidGeneSymbols = useCallback(
    (v: Set<string>) => setValidGeneSymbols(v),
    []
  );

  const [inValidGeneSymbols, setInValidGeneSymbols] = useState<Set<string>>(
    new Set([])
  );
  const handleSetInValidGeneSymbols = useCallback(
    (v: Set<string>) => setInValidGeneSymbols(v),
    []
  );

  const [allAvailableGenes, setAllAvailableGenes] = useState<Set<string>>(
    new Set([])
  );
  const handleSetAllAvailableGenes = useCallback(
    (v: Set<string>) => setAllAvailableGenes(v),
    []
  );

  const [effectSizeThreshold, setEffectSizeThreshold] = useState<number>(
    TERM_OPTIONS_FILTER_DEFAULTS.effectSizeThreshold
  );
  const handleSetEffectSizeThreshold = useCallback(
    (v: any) => {
      setEffectSizeThreshold((prevVal: number) => {
        const nextState = typeof v === "function" ? v(prevVal) : v;

        if (prevVal !== nextState) {
          // Invalidate the table selections if the user searches on a different list
          // of gene symbols.
          handleClearSelectedTableRows();
        }
        return nextState;
      });
    },
    [handleClearSelectedTableRows]
  );

  const [minMatchingQuery, setMinMatchingQuery] = useState<number>(
    TERM_OPTIONS_FILTER_DEFAULTS.minMatchingQuery
  );
  const handleSetMinMatchingQuery = useCallback(
    (v: any) => {
      setMinMatchingQuery((prevVal: number) => {
        const nextState = typeof v === "function" ? v(prevVal) : v;

        if (prevVal !== nextState) {
          // Invalidate the table selections if the user searches on a different list
          // of gene symbols.
          handleClearSelectedTableRows();
        }
        return nextState;
      });
    },
    [handleClearSelectedTableRows]
  );

  const [maxMatchingOverall, setMaxMatchingOverall] = useState<number | null>(
    TERM_OPTIONS_FILTER_DEFAULTS.maxMatchingOverall
  );
  const handleSetMaxMatchingOverall = useCallback(
    (v: any) => {
      setMaxMatchingOverall((prevVal: number | null) => {
        const nextState = typeof v === "function" ? v(prevVal) : v;

        if (prevVal !== nextState) {
          // Invalidate the table selections if the user searches on a different list
          // of gene symbols.
          handleClearSelectedTableRows();
        }
        return nextState;
      });
    },
    [handleClearSelectedTableRows]
  );

  const [maxTopTerms, setMaxTopTerms] = useState<number | null>(
    TERM_OPTIONS_FILTER_DEFAULTS.maxTopTerms
  );
  const handleSetMaxTopTerms = useCallback(
    (v: any) => {
      setMaxTopTerms((prevVal: number | null) => {
        const nextState = typeof v === "function" ? v(prevVal) : v;

        if (prevVal !== nextState) {
          // Invalidate the table selections if the user searches on a different list
          // of gene symbols.
          handleClearSelectedTableRows();
        }
        return nextState;
      });
    },
    [handleClearSelectedTableRows]
  );

  const [maxFDR, setMaxFDR] = useState<number>(
    TERM_OPTIONS_FILTER_DEFAULTS.maxFDR
  );
  const handleSetMaxFDR = useCallback((v: number) => setMaxFDR(v), []);

  const handleSetSelectionFromContext = useCallback(async () => {
    const labels = await promptForSelectionFromContext(
      validGeneSymbols,
      "gene"
    );
    if (labels === null) {
      return;
    }

    setSelectedPlotGenes(labels);
  }, [allAvailableGenes]);

  const [selectedPlotGenes, setSelectedPlotGenes] = useState<Set<string>>(
    new Set([])
  );

  const handleSetPlotSelectedGenes = useCallback(
    (selections: Set<string>, shiftKey: boolean) => {
      setSelectedPlotGenes((prev) => {
        const next: Set<string> = shiftKey ? new Set(prev) : new Set();

        selections.forEach((id) => {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        });

        return next;
      });
    },
    []
  );

  const handleClickSavePlotSelectionAsContext = useCallback(() => {
    if (selectedPlotGenes.size > 0) {
      const labels = [...selectedPlotGenes];
      const context = {
        name: defaultContextName(selectedPlotGenes.size),
        context_type: "gene",
        expr: { in: [{ var: "entity_label" }, labels] },
      };
      saveNewContext(context as DataExplorerContext);
    }
  }, [selectedPlotGenes]);

  const handleClearPlotSelection = useCallback(
    () => setSelectedPlotGenes(new Set([])),
    []
  );

  return (
    <GeneTeaContext.Provider
      value={{
        effectSizeThreshold,
        handleSetEffectSizeThreshold,
        minMatchingQuery,
        handleSetMinMatchingQuery,
        maxMatchingOverall,
        handleSetMaxMatchingOverall,
        maxTopTerms,
        handleSetMaxTopTerms,
        maxFDR,
        handleSetMaxFDR,
        doGroupTerms,
        handleSetDoGroupTerms,
        doClusterGenes,
        handleSetDoClusterGenes,
        doClusterTerms,
        handleSetDoClusterTerms,
        sortBy,
        handleSetSortBy,
        selectedTableRows,
        handleSetSelectedTableRows,
        geneSymbolSelections,
        handleSetGeneSymbolSelections,
        validGeneSymbols,
        handleSetValidGeneSymbols,
        inValidGeneSymbols,
        handleSetInValidGeneSymbols,
        allAvailableGenes,
        handleSetAllAvailableGenes,
        handleSetSelectionFromContext,
        handleClearSelectedTableRows,
        selectedPlotGenes,
        handleSetPlotSelectedGenes,
        handleClickSavePlotSelectionAsContext,
        handleClearPlotSelection,
        isLoading,
        handleSetIsLoading,
        error,
        handleSetError,
        errorMessage,
        handleSetErrorMessage,
      }}
    >
      {children}
    </GeneTeaContext.Provider>
  );
}

export function useGeneTeaContext() {
  const ctx = useContext(GeneTeaContext);
  if (!ctx) {
    throw new Error(
      "useGeneTeaContext must be used within GeneTeaContext.Provider"
    );
  }
  return ctx;
}
