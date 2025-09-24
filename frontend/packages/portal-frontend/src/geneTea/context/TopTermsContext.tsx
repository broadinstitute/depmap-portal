import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
} from "react";
import promptForSelectionFromContext from "../components/promptForSelectionFromContext";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { saveNewContext } from "src";
import { DataExplorerContext } from "@depmap/types";
import { useGeneTeaFiltersContext } from "./GeneTeaFiltersContext";

export interface TopTermsContextType {
  handleSetSelectionFromContext: () => Promise<void>;
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
  const {
    validGeneSymbols,
    selectedPlotGenes,
    handleSetPlotSelectedGenes,
  } = useGeneTeaFiltersContext();

  const handleSetSelectionFromContext = useCallback(async () => {
    const labels = await promptForSelectionFromContext(
      validGeneSymbols,
      "gene"
    );
    if (labels === null) {
      return;
    }

    handleSetPlotSelectedGenes(labels, false);
  }, [validGeneSymbols]);

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
    () => handleSetPlotSelectedGenes(new Set([]), false),
    []
  );

  return (
    <TopTermsContext.Provider
      value={{
        handleSetSelectionFromContext,
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
