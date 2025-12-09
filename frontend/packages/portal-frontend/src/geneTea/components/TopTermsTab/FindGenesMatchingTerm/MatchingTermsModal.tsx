import React, { useCallback, useState } from "react";
import { Button, Modal, Tab, Tabs } from "react-bootstrap";
import { DepMap } from "@depmap/globals";
import renderConditionally from "@depmap/data-explorer-2/src/utils/render-conditionally";
import styles from "@depmap/data-explorer-2/src/components/DataExplorerPage/styles/DataExplorer2.scss";
import ExcerptTable from "./ExcerptTable";

interface Props {
  termOrTermGroup: string;
  termsWithinSelectedGroup: string[] | null;
  termToMatchingGenesMap: Map<string, string[]>;
  onClose: () => void;
  groupByTerms: boolean;
}

function MatchingTermsModal({
  termOrTermGroup,
  termsWithinSelectedGroup,
  termToMatchingGenesMap,
  onClose,
  groupByTerms,
}: Props) {
  const [show, setShow] = useState(true);

  const handleClickCreateContext = useCallback(() => {
    setShow(false);

    // If the user is grouping terms, we want to look at all the matching genes across all terms within the selected term group
    const matchingGenes = groupByTerms
      ? termsWithinSelectedGroup?.flatMap(
          (term) => termToMatchingGenesMap.get(term) || []
        )
      : termToMatchingGenesMap.get(termOrTermGroup) || [];

    DepMap.saveNewContext(
      {
        name: termOrTermGroup,
        context_type: "gene",
        expr: { in: [{ var: "entity_label" }, matchingGenes] },
      },
      () => setShow(true)
    );
  }, [termOrTermGroup, termToMatchingGenesMap]);

  const modalBody = groupByTerms ? (
    <>
      <ExcerptTable
        term={termOrTermGroup}
        termToMatchingGenesMap={termToMatchingGenesMap}
      />
    </>
  ) : (
    <>
      <Tabs
        className={styles.termGroupTabs}
        id="gene_tea_term_group_terms_tabs"
      >
        {/* TODO: termsWithinSelectedGroup should not be allowed to be null so need to fix this upstream */}
        {termsWithinSelectedGroup!.map((term) => (
          <Tab eventKey={term} title={term} key={term}>
            <ExcerptTable
              term={term}
              termToMatchingGenesMap={termToMatchingGenesMap}
            />
          </Tab>
        ))}
      </Tabs>{" "}
    </>
  );

  return (
    <Modal show={show} bsSize="large" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Context for “{termOrTermGroup}”</Modal.Title>
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
