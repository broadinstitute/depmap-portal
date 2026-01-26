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
        <h2 className={styles.tutorialTitle}>Welcome to TEA party</h2>
        <p className={styles.subtitle}>
          This app facilitates overrepresentation analysis with GeneTEA. To see
          the top enriched terms for a list of genes enter them in the input
          filed to a left, or load an existing Gene Context. To search for a
          genes matching a term, type the term in the search bar below. Unsure
          of where to start? Check out the guided examples section for
          inspiration!
        </p>

        <div className={styles.termSearch}>
          <FormControl
            type="text"
            placeholder="Type term"
            value={inputValue}
            onChange={(e: any) => setInputValue(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" && inputValue.trim()) {
                handleSelect();
              }
            }}
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
        <h3>Guided Examples</h3>
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
