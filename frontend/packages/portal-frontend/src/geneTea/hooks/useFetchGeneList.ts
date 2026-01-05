import { useEffect, useState } from "react";
import { fetchGeneList } from "./utils";

export const useFetchGeneList = (
  useTerms: boolean,
  termOrTermGroup: string,
  termsArray: string[] | null,
  termToMatchingGenesObj: Record<string, string[]>,
  useAllGenes: boolean
) => {
  const [geneList, setGeneList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const termsKey = useTerms ? termOrTermGroup : termsArray?.join(",") || "";

  useEffect(() => {
    const loadGenes = async () => {
      if (!termsKey) {
        setGeneList([]);
        return;
      }

      setIsLoading(true);
      try {
        const finalGenes = await fetchGeneList(
          termsKey,
          termToMatchingGenesObj,
          useAllGenes
        );
        setGeneList(finalGenes);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGenes();
  }, [termsKey, termToMatchingGenesObj, useAllGenes]);

  return { geneList, isLoading };
};
