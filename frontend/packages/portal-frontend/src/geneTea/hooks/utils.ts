import { cached, legacyPortalAPI } from "@depmap/api";

export const fetchGeneList = async (
  termsString: string,
  termToMatchingGenesObj: Record<string, string[]>,
  useAllGenes: boolean
): Promise<string[]> => {
  const terms = termsString ? termsString.split(",") : [];

  if (terms.length === 0) return [];

  if (useAllGenes) {
    const allGenesData = await cached(
      legacyPortalAPI
    ).fetchGeneTeaGenesMatchingTermExperimental(terms, []);

    return Object.keys(allGenesData).flatMap(
      (term) => allGenesData[term]?.split(" ") || []
    );
  }

  if (terms.length === 1) {
    return termToMatchingGenesObj[terms[0]] || [];
  }

  return Array.from(
    new Set(terms.flatMap((term) => termToMatchingGenesObj[term] || []))
  );
};
