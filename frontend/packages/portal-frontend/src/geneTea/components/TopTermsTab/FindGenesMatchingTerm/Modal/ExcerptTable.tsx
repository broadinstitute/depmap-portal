import styles from "../../../../styles/GeneTea.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cached, legacyPortalAPI } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import GeneTeaTerm from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaTerm";
import { Alert, Button } from "react-bootstrap";
import { DepMap } from "@depmap/globals";

// Define the pagination limit
const PAGE_SIZE = 80;

interface ExcerptTableProps {
  useTerms: boolean;
  term: string;
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const ExcerptTable: React.FC<ExcerptTableProps> = ({
  useTerms,
  term,
  termToMatchingGenesMap,
  useAllGenes,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pageData, setPageData] = useState<Record<string, string> | null>(null);

  // State for pagination
  const [allGenesList, setAllGenesList] = useState<string[]>([]); // The full list of genes
  const [currentPage, setCurrentPage] = useState(0); // Current page index (0-based)

  // Total number of pages
  const totalPages = Math.ceil(allGenesList.length / PAGE_SIZE);

  // Determine the full list of genes based on props (local map or API fetch)
  const localMatchingGenes = useMemo(
    () => termToMatchingGenesMap.get(term) || [],
    [termToMatchingGenesMap, term]
  );

  // --- 1. Initial Gene List Fetch (Runs once per term) ---
  useEffect(() => {
    // If not using all genes, the list is already available locally
    if (!useAllGenes) {
      setAllGenesList(localMatchingGenes);
      setCurrentPage(0);
      return;
    }

    // If using all genes, fetch the complete list (without excerpts)
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const genesMatchingTermsData = await cached(
          legacyPortalAPI
        ).fetchGeneTeaGenesMatchingTermExperimental([term], []);

        const fullList = genesMatchingTermsData[term]?.split(" ") || [];

        setAllGenesList(fullList);
        setCurrentPage(0); // Always reset to the first page on new term
        setPageData(null);
      } catch (e) {
        setError(true);
        setPageData(null);
        window.console.error("Error fetching initial gene list:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [term, useAllGenes, localMatchingGenes]);

  // --- 2. Excerpt Data Fetch (Runs on term change and page change) ---
  useEffect(() => {
    // Only run if we have a list of genes and the list is not empty
    if (!allGenesList || allGenesList.length === 0) {
      setPageData(null);
      return;
    }

    // Calculate the subset of genes for the current page
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const genesForPage = allGenesList.slice(start, end);

    (async () => {
      setIsLoading(true);
      setError(false);
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
    })();
  }, [term, allGenesList, currentPage]); // Depends on term, full list, and current page

  // --- Context Creation Handler (Uses the full list) ---
  const handleClickCreateTermContext = useCallback(() => {
    DepMap.saveNewContext({
      name: term,
      context_type: "gene",
      expr: {
        in: [{ var: "entity_label" }, allGenesList],
      },
    });
  }, [term, allGenesList]);

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

  const totalMatchingGenes = allGenesList.length;

  return (
    <div className={styles.tableWrapper}>
      {" "}
      <p className={styles.tableParagraph}>
        The term “
        <GeneTeaTerm term={term} synonyms={[]} coincident={[]} />” is associated
        with {totalMatchingGenes} of the selected genes.
      </p>
      {!useTerms && (
        <div className={styles.saveAsContextButton}>
          <Button
            bsStyle="primary"
            bsSize="small"
            onClick={handleClickCreateTermContext}
          >
            Save Term as Gene Context
          </Button>
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Gene</th>
            <th>Excerpt</th>
          </tr>
        </thead>
        {pageData && !error && !isLoading && (
          <tbody>
            {Object.entries(pageData).map(([gene, context]) => {
              const html = context
                .replace(/<a href/g, '<a target="_blank" href')
                .replace(/ \| /g, "<br/><br/>");

              return (
                <tr key={gene}>
                  <td>
                    <a
                      href={`../gene/${gene}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {gene}
                    </a>
                  </td>
                  <td>
                    {/* eslint-disable-next-line react/no-danger */}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
      {/* Loading/Error States */}
      {isLoading && (
        <div className={styles.geneTeaModalSpinner}>
          <Spinner left="0px" position="static" />
        </div>
      )}
      {error && (
        <Alert bsStyle="danger">
          There was a problem retrieving the excerpt(s) for this term/page.
          Please try again!
        </Alert>
      )}
      {pageData && Object.keys(pageData).length === 0 && (
        <Alert bsStyle="danger">
          Could not find an excerpt for any gene on this page.{" "}
        </Alert>
      )}
      {/* Pagination Controls */}
      {totalMatchingGenes > PAGE_SIZE && !isLoading && (
        <div className={styles.paginationControls}>
          <Button
            onClick={handlePrevPage}
            disabled={currentPage === 0 || isLoading}
            bsSize="small"
            className={styles.paginationPrevButton}
          >
            Previous Page
          </Button>
          <span>
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1 || isLoading}
            bsSize="small"
            className={styles.paginationNextButton}
          >
            Next Page
          </Button>
          <p className={styles.pageCountLabel}>
            Displaying genes{" "}
            {Math.min(currentPage * PAGE_SIZE + 1, totalMatchingGenes)} to{" "}
            {Math.min((currentPage + 1) * PAGE_SIZE, totalMatchingGenes)}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExcerptTable;
