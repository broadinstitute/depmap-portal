// useExcerptData.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { cached, legacyPortalAPI } from "@depmap/api";
import { DepMap } from "@depmap/globals";

const PAGE_SIZE = 80;

interface UseExcerptDataResult {
  isLoading: boolean;
  error: boolean;
  pageData: Record<string, string> | null;
  allGenesList: string[];
  totalPages: number;
  currentPage: number;
  handleNextPage: () => void;
  handlePrevPage: () => void;
  handleClickCreateTermContext: () => void;
  totalMatchingGenes: number;
  pageSize: number;
}

export const useExcerptData = (
  term: string,
  termToMatchingGenesMap: Map<string, string[]>,
  useAllGenes: boolean
): UseExcerptDataResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pageData, setPageData] = useState<Record<string, string> | null>(null);
  const [allGenesList, setAllGenesList] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const totalMatchingGenes = allGenesList.length;
  const totalPages = Math.ceil(totalMatchingGenes / PAGE_SIZE);

  const matchingGenes = useMemo(() => termToMatchingGenesMap.get(term) || [], [
    termToMatchingGenesMap,
    term,
  ]);

  useEffect(() => {
    const fetchInitialList = async () => {
      setIsLoading(true);
      setError(false);
      try {
        let fullList: string[];
        if (useAllGenes) {
          const genesMatchingTermsData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaGenesMatchingTermExperimental([term], []);
          fullList = genesMatchingTermsData[term]?.split(" ") || [];
        } else {
          fullList = matchingGenes;
        }

        setAllGenesList(fullList);
        setCurrentPage(0);
        setPageData(null);
      } catch (e) {
        setError(true);
        setPageData(null);
        window.console.error("Error fetching initial gene list:", e);
      } finally {
        setIsLoading(false);
      }
    };

    if (!useAllGenes) {
      setAllGenesList(matchingGenes);
      setCurrentPage(0);
      setPageData(null);
      return;
    }

    fetchInitialList();
  }, [term, useAllGenes, matchingGenes]);

  // --- Excerpt Data Fetch (Page Change) ---
  useEffect(() => {
    if (!allGenesList || allGenesList.length === 0) {
      setPageData(null);
      return;
    }

    const start = currentPage * PAGE_SIZE;
    const genesForPage = allGenesList.slice(start, start + PAGE_SIZE);

    const fetchPageData = async () => {
      setIsLoading(true);
      setError(false);
      setPageData(null); // Clear old data immediately on page change

      try {
        const fetchedData = await cached(
          legacyPortalAPI
        ).fetchGeneTeaTermExcerptExperimental(term, genesForPage);

        setPageData(fetchedData);
      } catch (e) {
        setError(true);
        window.console.error("Error fetching excerpt data:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPageData();
  }, [term, allGenesList, currentPage]);

  // --- Pagination Handlers ---
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  // --- Context Creation Handler ---
  const handleClickCreateTermContext = useCallback(() => {
    if (typeof DepMap === "undefined" || !DepMap.saveNewContext) return;

    DepMap.saveNewContext({
      name: term,
      context_type: "gene",
      expr: {
        in: [{ var: "entity_label" }, allGenesList],
      },
    });
  }, [term, allGenesList]);

  return {
    isLoading,
    error,
    pageData,
    allGenesList,
    totalPages,
    currentPage,
    handleNextPage,
    handlePrevPage,
    handleClickCreateTermContext,
    totalMatchingGenes,
    pageSize: PAGE_SIZE,
  };
};
