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

export interface TopTermsContextType {
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

export const TopTermsContext = createContext<TopTermsContextType | undefined>(
  undefined
);

interface TopTermsContextProviderProps {
  children: ReactNode;
}

export function TopTermsContextProvider({
  children,
}: TopTermsContextProviderProps) {
  const { validGeneSymbols } = useGeneTeaFiltersContext();

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
    <TopTermsContext.Provider
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
    </TopTermsContext.Provider>
  );
}

export function useTopTermsContext() {
  const ctx = useContext(TopTermsContext);
  if (!ctx) {
    throw new Error(
      "useTopTermsContext must be used within TopTermsContext.Provider"
    );
  }
  return ctx;
}
