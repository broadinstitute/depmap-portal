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
    let finalGenes: string[] = [];

    if (useAllGenes) {
      // 1. Fetch genes from API
      const allGenesData = await cached(
        legacyPortalAPI
      ).fetchGeneTeaGenesMatchingTermExperimental(terms, []);

      // 2. Process fetched genes
      finalGenes = Object.keys(allGenesData).flatMap(
        (term) => allGenesData[term]?.split(" ") || []
      );
    } else if (terms.length === 1) {
      finalGenes = termToMatchingGenesMap.get(terms[0]) || [];
    } else {
      // 2. If grouping terms
      finalGenes = Array.from(
        new Set(terms.flatMap((term) => termToMatchingGenesMap.get(term) || []))
      );
    }

    // 3. Save the context
    await saveContext(name, finalGenes, onComplete);
  }, [name, terms, termToMatchingGenesMap, useAllGenes, onComplete]);
};
