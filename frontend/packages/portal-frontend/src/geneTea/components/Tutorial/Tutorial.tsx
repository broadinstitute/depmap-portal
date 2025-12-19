import React, { useState, useCallback } from "react";
import { Button, FormControl } from "react-bootstrap";
import MatchingTermsModal from "../TopTermsTab/FindGenesMatchingTerm/Modal/MatchingTermsModal";
import styles from "../../styles/GeneTea.scss";
import TutorialExamples from "./TutorialExamples";

const EMPTY_MAP = new Map<string, string[]>();

const Tutorial = () => {
  const [inputValue, setInputValue] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const handleSelect = useCallback(() => {
    const term = inputValue.trim();
    if (!term) return;

    setSelectedTerm(term);
  }, [inputValue]);

  return (
    <div className={styles.tutorialContainer}>
      <div className={styles.tutorialHeader}>
        <h2 className={styles.tutorialTitle}>Welcome to GeneTea</h2>
        <p className={styles.subtitle}>
          TeaParty is a model that takes in free-text gene descriptions and
          incorporates several natural language processing methods to learn a
          sparse gene-by-term embedding, which can be treated as a de novo gene
          set database.
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
            maxWidth: "500px",
          }}
        >
          <FormControl
            type="text"
            placeholder="Type term"
            value={inputValue}
            onChange={(e: any) => setInputValue(e.target.value)}
          />
          <Button
            bsStyle="primary"
            onClick={handleSelect}
            disabled={!inputValue.trim()}
            style={{ minWidth: "80px" }}
          >
            Select
          </Button>
        </div>
      </div>
      <div className={styles.gettingStarted}>
        <TutorialExamples />
      </div>

      <MatchingTermsModal
        show={Boolean(selectedTerm)}
        termOrTermGroup={selectedTerm || ""}
        termsWithinSelectedGroup={null}
        termToMatchingGenesMap={EMPTY_MAP}
        onClose={() => setSelectedTerm(null)}
        useTerms
        useAllGenes
      />
    </div>
  );
};

export default Tutorial;
