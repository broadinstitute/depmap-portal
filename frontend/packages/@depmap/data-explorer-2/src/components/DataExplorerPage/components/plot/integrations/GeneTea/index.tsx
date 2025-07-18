import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { cached, legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import { DataExplorerContext } from "@depmap/types";
import ExplanatoryText from "./ExplanatoryText";
import GeneTeaTable from "./GeneTeaTable";
import GeneTeaContextModal from "./GeneTeaContextModal";
import { MIN_SELECTION, MAX_SELECTION, DEFAULT_NUM_ROWS } from "./constants";
import styles from "../../../../styles/DataExplorer2.scss";

interface Props {
  selectedLabels: Set<string> | null;
  onClickColorByContext: (context: DataExplorerContext) => void;
}

type GeneTeaEnrichedTerms = LegacyPortalApiResponse["fetchGeneTeaEnrichment"];

function GeneTea({ selectedLabels, onClickColorByContext }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GeneTeaEnrichedTerms | null>(null);
  const [error, setError] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [selectedTerm, setSelectTerm] = useState<string | null>(null);
  const [matchingGenes, setMatchingGenes] = useState<string[] | null>(null);
  const [synonyms, setSynonyms] = useState<string[] | null>(null);
  const [coincident, setCoincident] = useState<string[] | null>(null);

  useEffect(() => {
    setData(null);

    if (!selectedLabels || selectedLabels.size === 0) {
      setShowAllRows(false);
    }
  }, [selectedLabels]);

  useEffect(() => {
    if (
      selectedLabels &&
      selectedLabels.size >= MIN_SELECTION &&
      selectedLabels.size <= MAX_SELECTION
    ) {
      setIsLoading(true);
      setError(false);

      (async () => {
        try {
          const fetchedData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaEnrichment(
            [...selectedLabels],
            showAllRows ? null : DEFAULT_NUM_ROWS
          );
          setData(fetchedData);
        } catch (e) {
          setError(true);
          window.console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [selectedLabels, showAllRows]);

  const showTable = data && data.term.length > 0;
  const numMoreTerms = data ? data.total - data.term.length : 0;
  const showMoreTermsButton =
    data && data.total > data.term.length && !isLoading;

  return (
    <div className={styles.GeneTea}>
      {isLoading && !showAllRows && (
        <Spinner className={styles.geneTeaSpinner} position="static" />
      )}

      <ExplanatoryText
        error={error}
        noTermsFound={data !== null && data.term.length === 0}
        selectMore={
          selectedLabels === null || selectedLabels.size < MIN_SELECTION
        }
        selectLess={
          selectedLabels !== null && selectedLabels.size > MAX_SELECTION
        }
      />

      {showTable && (
        <>
          <div className={styles.plotInstructions}>
            These terms appear frequently in the query genes relative to all
            genes.
          </div>
          <GeneTeaTable
            data={data}
            onClickColorByContext={onClickColorByContext}
            onClickTerm={(term, genes, synonymousTerms, coincidentTerms) => {
              setSelectTerm(term);
              setMatchingGenes(genes);
              setSynonyms(synonymousTerms);
              setCoincident(coincidentTerms);
            }}
          />
        </>
      )}

      {showMoreTermsButton && (
        <div className={styles.showMoreTerms}>
          <button type="button" onClick={() => setShowAllRows(true)}>
            {numMoreTerms} more {numMoreTerms === 1 ? "term" : "terms"}
          </button>{" "}
          in this query
        </div>
      )}

      {isLoading && showAllRows && (
        <Spinner className={styles.geneTeaSpinner} position="static" />
      )}

      <div>
        <Button
          className={styles.viewInTeaParty}
          bsStyle="primary"
          target="_blank"
          disabled={
            !selectedLabels ||
            selectedLabels.size < MIN_SELECTION ||
            selectedLabels.size > MAX_SELECTION ||
            data?.term.length === 0
          }
          href={`../../genetea/?genes=${
            selectedLabels && [...selectedLabels].join("+")
          }`}
        >
          View in TEAparty
        </Button>
      </div>

      <GeneTeaContextModal
        show={Boolean(selectedTerm)}
        term={selectedTerm || ""}
        synonyms={synonyms || []}
        coincident={coincident || []}
        matchingGenes={matchingGenes || []}
        onClose={() => setSelectTerm(null)}
      />
    </div>
  );
}

export default GeneTea;
