import React, { useMemo } from "react";
import { Spinner } from "@depmap/common-components";
import GeneTeaTerm from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaTerm";
import { Alert, Button } from "react-bootstrap";
import { useExcerptData } from "../../../../../hooks/useExcerptData";
import PaginationControls from "./PaginationControls";
import styles from "../../../../../styles/GeneTea.scss";
import CopyListButton from "../CopyListButton";
import { useFetchGeneList } from "src/geneTea/hooks/useFetchGeneList";

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
}: ExcerptTableProps) => {
  const termToMatchingGenesObj = useMemo(() => {
    return Object.fromEntries(termToMatchingGenesMap);
  }, [termToMatchingGenesMap]);

  const {
    isLoading: isDataLoading,
    error,
    pageData,
    totalPages,
    currentPage,
    handleNextPage,
    handlePrevPage,
    handleClickCreateTermContext,
    totalMatchingGenes,
    pageSize,
  } = useExcerptData(term, termToMatchingGenesMap, useAllGenes);

  const { geneList, isLoading: isListLoading } = useFetchGeneList(
    useTerms,
    term,
    [term],
    termToMatchingGenesObj,
    useAllGenes
  );

  const isLoading = isDataLoading || isListLoading;

  const renderTableBody = () => {
    if (!pageData) return null;

    return (
      <tbody>
        {Object.entries(pageData).map(([gene, context]) => {
          const html = context
            .replace(/<a href/g, '<a target="_blank" href')
            .replace(/ \| /g, "<br/><br/>");

          return (
            <tr key={gene}>
              <td>
                <a href={`../gene/${gene}`} target="_blank" rel="noreferrer">
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
    );
  };

  return (
    <div className={styles.tableWrapper}>
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
            disabled={isLoading}
            onClick={handleClickCreateTermContext}
          >
            {isLoading ? "Loading..." : "Save Term as Gene Context"}
          </Button>
          <CopyListButton
            key="excerpt-table-copy-button"
            items={geneList}
            title={"Copy Gene List"}
            disabled={isLoading || geneList.length === 0}
          />
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Gene</th>
            <th>Excerpt</th>
          </tr>
        </thead>
        {renderTableBody()}
      </table>

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

      {!isLoading &&
        !error &&
        totalMatchingGenes > 0 &&
        pageData &&
        Object.keys(pageData).length === 0 && (
          <Alert bsStyle="danger">
            Could not find an excerpt for any gene on this page.
          </Alert>
        )}

      {!isLoading && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalMatchingGenes={totalMatchingGenes}
          pageSize={pageSize}
          isLoading={isLoading}
          handleNextPage={handleNextPage}
          handlePrevPage={handlePrevPage}
        />
      )}
    </div>
  );
};

export default ExcerptTable;
