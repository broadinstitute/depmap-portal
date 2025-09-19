import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { SortOption } from "../types";
import promptForSelectionFromContext from "../components/promptForSelectionFromContext";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { saveNewContext } from "src";
import { DataExplorerContext } from "@depmap/types";
import { useGeneTeaFiltersContext } from "./GeneTeaFiltersContext";

export interface AllTermsContextType {
  selectedTableRows: Set<string>;
  handleSetSelectedTableRows: (v: Set<string>) => void;
  handleSetSelectionFromContext: () => Promise<void>;
  handleClearSelectedTableRows: () => void;
  selectedPlotGenes: Set<string>;
  handleSetPlotSelectedGenes: (
    selections: Set<string>,
    shiftKey: boolean
  ) => void;
  handleClickSavePlotSelectionAsContext: () => void;
  handleClearPlotSelection: () => void;
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
  const { geneSymbolSelections, validGeneSymbols } = useGeneTeaFiltersContext();

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

  const prevGeneSymbolSelections = useRef<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevGeneSymbolSelections.current;
    const curr = geneSymbolSelections;

    const setsAreEqual =
      prev.size === curr.size && [...prev].every((val) => curr.has(val));

    if (!setsAreEqual) {
      handleClearSelectedTableRows();
    }

    // Update ref for next comparison
    prevGeneSymbolSelections.current = new Set(curr);
  }, [geneSymbolSelections]);

  const [selectedPlotGenes, setSelectedPlotGenes] = useState<Set<string>>(
    new Set([])
  );
  const handleSetSelectionFromContext = useCallback(async () => {
    const labels = await promptForSelectionFromContext(
      validGeneSymbols,
      "gene"
    );
    if (labels === null) {
      return;
    }

    setSelectedPlotGenes(labels);
  }, [validGeneSymbols]);

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
    <AllTermsContext.Provider
      value={{
        selectedTableRows,
        handleSetSelectedTableRows,
        handleSetSelectionFromContext,
        handleClearSelectedTableRows,
        selectedPlotGenes,
        handleSetPlotSelectedGenes,
        handleClickSavePlotSelectionAsContext,
        handleClearPlotSelection,
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
