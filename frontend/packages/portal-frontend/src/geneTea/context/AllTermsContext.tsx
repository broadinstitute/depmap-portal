import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useGeneTeaFiltersContext } from "./GeneTeaFiltersContext";

export interface AllTermsContextType {
  selectedPlotOrTableTerms: Set<string>;
  handleClearPlotAndTableSelection: () => void;
  handleSetPlotOrTableSelectedTerms: (
    selections: Set<string>,
    shiftKey: boolean
  ) => void;
}

export const AllTermsContext = createContext<AllTermsContextType | undefined>(
  undefined
);

interface AllTermsContextProviderProps {
  children: ReactNode;
}

export function AllTermsContextProvider({
  children,
}: AllTermsContextProviderProps) {
  const { geneSymbolSelections } = useGeneTeaFiltersContext();

  const [selectedPlotOrTableTerms, setSelectedPlotOrTableTerms] = useState<
    Set<string>
  >(new Set([]));

  // Clear selection when geneSymbolSelections changes
  useEffect(() => {
    setSelectedPlotOrTableTerms(new Set([]));
  }, [geneSymbolSelections]);

  const handleSetPlotOrTableSelectedTerms = useCallback(
    (selections: Set<string>, shiftKey: boolean) => {
      setSelectedPlotOrTableTerms((prev) => {
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

  const handleClearPlotAndTableSelection = useCallback(
    () => setSelectedPlotOrTableTerms(new Set([])),
    []
  );

  return (
    <AllTermsContext.Provider
      value={{
        selectedPlotOrTableTerms,
        handleSetPlotOrTableSelectedTerms,
        handleClearPlotAndTableSelection,
      }}
    >
      {children}
    </AllTermsContext.Provider>
  );
}

export function useAllTermsContext() {
  const ctx = useContext(AllTermsContext);
  if (!ctx) {
    throw new Error(
      "useAllTermsContext must be used within AllTermsContext.Provider"
    );
  }
  return ctx;
}
