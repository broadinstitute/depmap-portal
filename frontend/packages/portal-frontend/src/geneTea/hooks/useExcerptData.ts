import { useEffect, useState, useRef } from "react";
import { cached, legacyPortalAPI } from "@depmap/api";

const PAGE_SIZE = 80;

export const useExcerptData = (
  term: string,
  termToMatchingGenesObj: Record<string, string[]>,
  useAllGenes: boolean
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pageData, setPageData] = useState<Record<string, string> | null>(null);
  const [allGenesList, setAllGenesList] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // We use a ref to track the last successful fetch to prevent StrictMode double-fire
  const lastRequestKey = useRef("");

  useEffect(() => {
    let isCurrent = true;
    const requestKey = `${term}-${useAllGenes}-${currentPage}`;

    // 1. Skip if this exact request is already handled
    if (lastRequestKey.current === requestKey) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(false);

      try {
        // --- STEP A: Get the Gene List ---
        let list: string[];
        if (useAllGenes) {
          const data = await cached(
            legacyPortalAPI
          ).fetchGeneTeaGenesMatchingTermExperimental([term], []);
          list = data[term]?.split(" ") || [];
        } else {
          list = termToMatchingGenesObj[term] || [];
        }

        if (!isCurrent) return;
        setAllGenesList(list);

        // --- STEP B: Get the Excerpts immediately using the fresh list ---
        if (list.length > 0) {
          const start = currentPage * PAGE_SIZE;
          const genesForPage = list.slice(start, start + PAGE_SIZE);

          const fetchedData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaTermExcerptExperimental(term, genesForPage);

          if (isCurrent) {
            setPageData(fetchedData);
            lastRequestKey.current = requestKey; // 2. Mark as successful
          }
        } else {
          setPageData({});
        }
      } catch (e) {
        if (isCurrent) {
          setError(true);
          console.error("Fetch failed:", e);
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    fetchData();

    () => {
      isCurrent = false;
    };
  }, [term, useAllGenes, termToMatchingGenesObj, currentPage]);

  return {
    isLoading,
    error,
    pageData,
    allGenesList,
    totalPages: Math.ceil(allGenesList.length / PAGE_SIZE),
    currentPage,
    handleNextPage: () => setCurrentPage((p) => p + 1),
    handlePrevPage: () => setCurrentPage((p) => p - 1),
    totalMatchingGenes: allGenesList.length,
    pageSize: PAGE_SIZE,
    handleClickCreateTermContext: () => {}, // existing logic
  };
};
