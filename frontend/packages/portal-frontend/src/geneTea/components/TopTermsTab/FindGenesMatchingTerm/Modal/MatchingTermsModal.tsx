import React, { useCallback, useState, useMemo } from "react";
import { Button, Modal } from "react-bootstrap";
import renderConditionally from "@depmap/data-explorer-2/src/utils/render-conditionally";
import styles from "../../../../styles/GeneTea.scss";
import ExcerptTable from "./ExcerptTable/ExcerptTable";
import TermGroupTabs from "./TermGroupTabs";
import { useGeneContextCreation } from "../../../../hooks/useCreateGeneContext";
import CopyListButton from "./CopyListButton/CopyListButton";
import { useFetchGeneList } from "src/geneTea/hooks/useFetchGeneList";

interface Props {
  termOrTermGroup: string;
  termsWithinSelectedGroup: string[] | null;
  termToMatchingGenesMap: Map<string, string[]>;
  onClose: () => void;
  useTerms: boolean;
  useAllGenes: boolean;
}

function MatchingTermsModal({
  termOrTermGroup,
  termsWithinSelectedGroup,
  termToMatchingGenesMap,
  onClose,
  useTerms,
  useAllGenes,
}: Props) {
  const [show, setShow] = useState(true);

  const termToMatchingGenesObj = useMemo(() => {
    return Object.fromEntries(termToMatchingGenesMap);
  }, [termToMatchingGenesMap]);

  const termsKey = useMemo(() => {
    const terms = useTerms ? [termOrTermGroup] : termsWithinSelectedGroup || [];
    return terms.join(",");
  }, [useTerms, termOrTermGroup, termsWithinSelectedGroup]);

  const { geneList, isLoading } = useFetchGeneList(
    useTerms,
    termOrTermGroup,
    termsWithinSelectedGroup,
    termToMatchingGenesObj,
    useAllGenes
  );

  const handleContextSaveComplete = useCallback(() => setShow(true), []);

  const handleClickCreateContext = useGeneContextCreation({
    name: termOrTermGroup,
    termsKey: termsKey,
    termToMatchingGenesObj: termToMatchingGenesObj,
    useAllGenes,
    onComplete: handleContextSaveComplete,
  });

  const modalBody = useMemo(() => {
    if (useTerms || termsWithinSelectedGroup?.length === 1) {
      return (
        <ExcerptTable
          useTerms={useTerms}
          term={termOrTermGroup}
          termToMatchingGenesMap={termToMatchingGenesMap}
          useAllGenes={useAllGenes}
        />
      );
    }

    if (!termsWithinSelectedGroup || termsWithinSelectedGroup.length === 0) {
      return <div>No terms found for this group.</div>;
    }

    return (
      <TermGroupTabs
        termGroup={termOrTermGroup}
        termsWithinSelectedGroup={termsWithinSelectedGroup}
        termToMatchingGenesMap={termToMatchingGenesMap}
        useAllGenes={useAllGenes}
      />
    );
  }, [
    useTerms,
    termOrTermGroup,
    termToMatchingGenesMap,
    useAllGenes,
    termsWithinSelectedGroup,
  ]);

  return (
    <Modal show={show} bsSize="large" onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Excerpts for “{termOrTermGroup}”</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.GeneTeaModal}>{modalBody}</Modal.Body>
      <Modal.Footer className={styles.modalFooterRow}>
        <Button onClick={onClose}>Close</Button>
        <Button
          bsStyle="primary"
          disabled={isLoading}
          onClick={handleClickCreateContext}
        >
          {isLoading
            ? "Loading..."
            : useTerms
            ? "Save as Gene Context"
            : "Save Group as Gene Context"}
        </Button>
        <CopyListButton
          items={geneList}
          title={"Copy Gene List"}
          disabled={isLoading}
        />
      </Modal.Footer>
    </Modal>
  );
}

export default renderConditionally(MatchingTermsModal);
