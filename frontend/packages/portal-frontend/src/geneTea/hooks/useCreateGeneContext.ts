import { useCallback } from "react";
import { DepMap } from "@depmap/globals";
import { cached, legacyPortalAPI } from "@depmap/api";

interface GeneContextCreationParams {
  name: string; // termOrTermGroup
  terms: string[]; // List of terms to fetch genes for
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
  onComplete: () => void;
}

export const fetchGeneList = async (
  terms: string[],
  termToMatchingGenesMap: Map<string, string[]>,
  useAllGenes: boolean
): Promise<string[]> => {
  if (useAllGenes) {
    const allGenesData = await cached(
      legacyPortalAPI
    ).fetchGeneTeaGenesMatchingTermExperimental(terms, []);

    return Object.keys(allGenesData).flatMap(
      (term) => allGenesData[term]?.split(" ") || []
    );
  }

  if (terms.length === 1) {
    return termToMatchingGenesMap.get(terms[0]) || [];
  }

  return Array.from(
    new Set(terms.flatMap((term) => termToMatchingGenesMap.get(term) || []))
  );
};

/**
 * Utility function to consolidate gene fetching and context saving logic.
 */
const saveContext = async (
  contextName: string,
  geneList: string[],
  onComplete: () => void
) => {
  DepMap.saveNewContext(
    {
      name: contextName,
      context_type: "gene",
      expr: { in: [{ var: "entity_label" }, geneList] },
    },
    onComplete
  );
};

export const useGeneContextCreation = ({
  name,
  terms,
  termToMatchingGenesMap,
  useAllGenes,
  onComplete,
}: GeneContextCreationParams) => {
  return useCallback(async () => {
    const finalGenes = await fetchGeneList(
      terms,
      termToMatchingGenesMap,
      useAllGenes
    );

    // 3. Save the context
    await saveContext(name, finalGenes, onComplete);
  }, [name, terms, termToMatchingGenesMap, useAllGenes, onComplete]);
};
