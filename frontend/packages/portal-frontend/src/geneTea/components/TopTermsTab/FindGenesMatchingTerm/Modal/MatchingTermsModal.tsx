import React, { useCallback, useState, useMemo, useEffect } from "react";
import { Button, Modal } from "react-bootstrap";
import renderConditionally from "@depmap/data-explorer-2/src/utils/render-conditionally";
import styles from "../../../../styles/GeneTea.scss";
import ExcerptTable from "./ExcerptTable/ExcerptTable";
import TermGroupTabs from "./TermGroupTabs";
import {
  fetchGeneList,
  useGeneContextCreation,
} from "../../../../hooks/useCreateGeneContext";
import CopyListButton from "./CopyListButton";

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
  const [geneList, setGeneList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Effect for "Copy Genes" button.
  useEffect(() => {
    const loadGenes = async () => {
      const terms = useTerms ? [termOrTermGroup] : termsWithinSelectedGroup;

      setIsLoading(true);
      try {
        const finalGenes = await fetchGeneList(
          terms || [],
          termToMatchingGenesMap,
          useAllGenes
        );
        setGeneList(finalGenes);
      } catch (error) {
        console.error("Failed to fetch genes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGenes();
  }, [
    termToMatchingGenesMap,
    termsWithinSelectedGroup,
    useTerms,
    termOrTermGroup,
    useAllGenes,
  ]);

  const handleContextSaveComplete = useCallback(() => setShow(true), []);

  // --- 1. SINGLE TERM CONTEXT CREATION ---
  const handleClickCreateTermContext = useGeneContextCreation({
    name: termOrTermGroup,
    terms: useTerms ? [termOrTermGroup] : [],
    termToMatchingGenesMap,
    useAllGenes,
    onComplete: handleContextSaveComplete,
  });

  // --- 2. TERM GROUP CONTEXT CREATION ---
  const handleClickCreateTermGroupContext = useGeneContextCreation({
    name: termOrTermGroup,
    terms: termsWithinSelectedGroup || [], // Pass all terms in the group
    termToMatchingGenesMap,
    useAllGenes,
    onComplete: handleContextSaveComplete,
  });

  const modalBody = useMemo(() => {
    // If not grouping terms
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

    // If grouping terms
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
          onClick={
            useTerms
              ? handleClickCreateTermContext
              : handleClickCreateTermGroupContext
          }
        >
          {useTerms
            ? "Save as Gene Context"
            : `Save Term Group as Gene Context`}
        </Button>
        <CopyListButton items={geneList} title={"Copy Gene List"} />
      </Modal.Footer>
    </Modal>
  );
}

export default renderConditionally(MatchingTermsModal);
