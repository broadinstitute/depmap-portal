import { useCallback } from "react";
import { DepMap } from "@depmap/globals";
import { fetchGeneList } from "./utils";

interface GeneContextCreationParams {
  name: string;
  termsKey: string; // "term1,term2,term3"
  termToMatchingGenesObj: Record<string, string[]>;
  useAllGenes: boolean;
  onComplete: () => void;
}

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
  termsKey,
  termToMatchingGenesObj,
  useAllGenes,
  onComplete,
}: GeneContextCreationParams) => {
  return useCallback(async () => {
    const finalGenes = await fetchGeneList(
      termsKey,
      termToMatchingGenesObj,
      useAllGenes
    );

    if (finalGenes.length > 0) {
      await saveContext(name, finalGenes, onComplete);
    }

    return finalGenes;
  }, [name, termsKey, termToMatchingGenesObj, useAllGenes, onComplete]);
};
