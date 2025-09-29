import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { SortOption } from "../types";

// TODO organize this file a little better...
export const TERM_OPTIONS_FILTER_DEFAULTS = {
  sortBy: "Effect Size",
  maxTopTerms: 10,
  maxFDR: 0.05,
  effectSizeThreshold: 0.1,
  minMatchingQuery: 2,
  maxMatchingOverall: 5373,
};

export interface GeneTeaFiltersContextType {
  selectedPlotGenes: Set<string>;
  handleSetPlotSelectedGenes: (
    selections: Set<string>,
    shiftKey: boolean
  ) => void;
  handleClearSelectedTopTermsTableRows: () => void;
  selectedTopTermsTableRows: Set<string>;
  handleSetSelectedTopTermsTableRows: (v: Set<string>) => void;
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
  geneSymbolSelections: Set<string>;
  handleSetGeneSymbolSelections: (v: any) => void;
  validGeneSymbols: Set<string>;
  handleSetValidGeneSymbols: (v: Set<string>) => void;
  inValidGeneSymbols: Set<string>;
  handleSetInValidGeneSymbols: (v: Set<string>) => void;
  allAvailableGenes: Set<string>;
  handleSetAllAvailableGenes: (v: Set<string>) => void;
  isLoading: boolean;
  handleSetIsLoading: (v: boolean) => void;
  error: boolean;
  handleSetError: (v: boolean) => void;
  errorMessage: string;
  handleSetErrorMessage: (v: string) => void;
}

export const GeneTeaFiltersContext = createContext<
  GeneTeaFiltersContextType | undefined
>(undefined);

interface GeneTeaFiltersContextProviderProps {
  children: ReactNode;
}

export function GeneTeaFiltersContextProvider({
  children,
}: GeneTeaFiltersContextProviderProps) {
  // This is a little weird, because we DO have a separate context for the TopTerms tab, but the TopTerms selected
  // table rows needs to be more widely available state and essentially acts like a filter passed
  // into useData and the GeneTea api request as plot_selections. When selected Top Terms changes, this affects
  // BOTH tabs.
  const [selectedTopTermsTableRows, setSelectedTopTermsTableRows] = useState<
    Set<string>
  >(new Set());
  const handleSetSelectedTopTermsTableRows = useCallback(
    (v: Set<string>) => setSelectedTopTermsTableRows(v),
    []
  );
  const handleClearSelectedTopTermsTableRows = useCallback(
    () => setSelectedTopTermsTableRows(new Set([])),
    []
  );

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
          handleClearSelectedTopTermsTableRows();
        }

        return nextState;
      });
    },
    [handleClearSelectedTopTermsTableRows]
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
          handleClearSelectedTopTermsTableRows();
        }

        return nextState;
      });
    },
    [handleClearSelectedTopTermsTableRows]
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
          handleClearSelectedTopTermsTableRows();
        }

        return nextState;
      });
    },
    [handleClearSelectedTopTermsTableRows]
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
          handleClearSelectedTopTermsTableRows();
        }

        return nextState;
      });
    },
    [handleClearSelectedTopTermsTableRows]
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
          handleClearSelectedTopTermsTableRows();
        }

        return nextState;
      });
    },
    [handleClearSelectedTopTermsTableRows]
  );

  const [maxFDR, setMaxFDR] = useState<number>(
    TERM_OPTIONS_FILTER_DEFAULTS.maxFDR
  );
  const handleSetMaxFDR = useCallback((v: number) => setMaxFDR(v), []);

  return (
    <GeneTeaFiltersContext.Provider
      value={{
        selectedPlotGenes,
        handleSetPlotSelectedGenes,
        handleClearSelectedTopTermsTableRows,
        selectedTopTermsTableRows,
        handleSetSelectedTopTermsTableRows,
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
        geneSymbolSelections,
        handleSetGeneSymbolSelections,
        validGeneSymbols,
        handleSetValidGeneSymbols,
        inValidGeneSymbols,
        handleSetInValidGeneSymbols,
        allAvailableGenes,
        handleSetAllAvailableGenes,
        isLoading,
        handleSetIsLoading,
        error,
        handleSetError,
        errorMessage,
        handleSetErrorMessage,
      }}
    >
      {children}
    </GeneTeaFiltersContext.Provider>
  );
}

export function useGeneTeaFiltersContext() {
  const ctx = useContext(GeneTeaFiltersContext);
  if (!ctx) {
    throw new Error(
      "useGeneTeaFiltersContext must be used within GeneTeaFiltersContext.Provider"
    );
  }
  return ctx;
}
