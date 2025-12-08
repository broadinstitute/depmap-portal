import React, { useCallback, useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { cached, legacyPortalAPI } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import renderConditionally from "@depmap/data-explorer-2/src/utils/render-conditionally";
import GeneTeaTerm from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaTerm";
import styles from "../../../../styles/DataExplorer2.scss";

interface Props {
  term: string;
  synonyms: string[];
  coincident: string[];
  matchingGenes: string[];
  onClose: () => void;
  groupByTerms: boolean;
}

function MatchingTermsModal({
  term,
  synonyms,
  coincident,
  matchingGenes,
  onClose,
  groupByTerms,
}: Props) {
  const [show, setShow] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(false);

      try {
        const fetchedData = await cached(
          legacyPortalAPI
        ).fetchGeneTeaTermContext(term, matchingGenes);
        setData(fetchedData);
      } catch (e) {
        setError(true);
        window.console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [term, matchingGenes]);

  const handleClickCreateContext = useCallback(() => {
    setShow(false);

    DepMap.saveNewContext(
      {
        name: term,
        context_type: "gene",
        expr: { in: [{ var: "entity_label" }, matchingGenes] },
      },
      () => setShow(true)
    );
  }, [term, matchingGenes]);

  const modalBody = groupByTerms ? (
    <>
      <p>
        The term “
        <GeneTeaTerm term={term} synonyms={synonyms} coincident={coincident} />”
        is associated with {matchingGenes.length} of the selected genes.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Gene</th>
            <th>Context</th>
          </tr>
        </thead>
        {data && (
          <tbody>
            {Object.entries(data).map(([gene, context]) => {
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
      {isLoading && (
        <div className={styles.geneTeaModalSpinner}>
          <Spinner left="0px" position="static" />
        </div>
      )}
      {error && (
        <h2>
          Sorry, there was a problem retrieving the context for this term 😭
        </h2>
      )}
      {data && Object.keys(data).length === 0 && (
        <h2>Hmm, the context for this term seems to have gone missing 🤔</h2>
      )}
    </>
  ) : (
    <>
      {" "}
      <Tabs
        className={styles.termGroupTabs}
        defaultActiveKey={1}
        id="gene_tea_term_group_terms_tabs"
      ></Tabs>{" "}
    </>
  );

  return (
    <Modal show={show} bsSize="large" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Context for “{term}”</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.GeneTeaModal}>{modalBody}</Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>Close</Button>
        <Button bsStyle="primary" onClick={handleClickCreateContext}>
          Save as Gene Context
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default renderConditionally(MatchingTermsModal);
