import React, { createContext, useContext } from "react";
import { SortOption } from "../types";

export interface GeneTeaContextType {
  effectSizeThreshold: number;
  setEffectSizeThreshold: React.Dispatch<React.SetStateAction<number>>;
  minMatchingQuery: number;
  setMinMatchingQuery: React.Dispatch<React.SetStateAction<number>>;
  maxMatchingOverall: number | null;
  setMaxMatchingOverall: React.Dispatch<React.SetStateAction<number | null>>;
  maxTopTerms: number | null;
  setMaxTopTerms: React.Dispatch<React.SetStateAction<number | null>>;
  maxFDR: number;
  setMaxFDR: React.Dispatch<React.SetStateAction<number>>;
  doGroupTerms: boolean;
  setDoGroupTerms: (v: boolean) => void;
  doClusterGenes: boolean;
  setDoClusterGenes: (v: boolean) => void;
  doClusterTerms: boolean;
  setDoClusterTerms: (v: boolean) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  geneSymbolSelections: Set<string>;
  setGeneSymbolSelections: React.Dispatch<React.SetStateAction<Set<string>>>;
  validGeneSymbols: Set<string>;
  setValidGeneSymbols: React.Dispatch<React.SetStateAction<Set<string>>>;
  inValidGeneSymbols: Set<string>;
  setInValidGeneSymbols: React.Dispatch<React.SetStateAction<Set<string>>>;
  allAvailableGenes: Set<string>;
  setAllAvailableGenes: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleSetSelectionFromContext: () => Promise<void>;
}

export const GeneTeaContext = createContext<GeneTeaContextType | undefined>(
  undefined
);

export function useGeneTeaContext() {
  const ctx = useContext(GeneTeaContext);
  if (!ctx)
    throw new Error(
      "useGeneTeaContext must be used within GeneTeaContext.Provider"
    );
  return ctx;
}
