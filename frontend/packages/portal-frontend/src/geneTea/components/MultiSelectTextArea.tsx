import React, { useState } from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/MultiSelectTextArea.scss";
import { useGeneTeaContext } from "../context/GeneTeaContext";

const MultiSelectTextarea: React.FC = () => {
  const {
    geneSymbolSelections,
    setGeneSymbolSelections,
    validGeneSymbols,
    setValidGeneSymbols,
    inValidGeneSymbols,
    setInValidGeneSymbols,
  } = useGeneTeaContext();

  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e: any) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter" && inputValue.trim() !== "") {
      e.preventDefault(); // Prevent newline in textarea
      const newItems = inputValue
        .split(/[, ]+/)
        .filter((item) => item.trim() !== "");
      setGeneSymbolSelections(
        (prevChips: Set<string>) => new Set([...prevChips, ...newItems])
      ); // Add only unique items
      setInputValue(""); // Clear input
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    setGeneSymbolSelections(
      (prevChips) =>
        new Set([...prevChips].filter((chip) => chip !== chipToRemove))
    );
  };

  return (
    <div className={styles.multiSelectTextareaContainer}>
      <h4 className={styles.sectionTitle}>Enter Gene Symbols</h4>
      <div className={styles.multiSelectTextareaBorder}>
        <div className={styles.chipList}>
          {[...geneSymbolSelections].map((chip, index) => {
            let chipClass = styles.chip;
            if (inValidGeneSymbols && inValidGeneSymbols.has(chip)) {
              chipClass += " " + styles.chipInvalid;
            } else if (validGeneSymbols && validGeneSymbols.has(chip)) {
              chipClass += " " + styles.chipValid;
            }
            return (
              <span className={chipClass} key={index}>
                {chip}
                <button
                  className={styles.chipRemoveButton}
                  onClick={() => handleRemoveChip(chip)}
                >
                  x
                </button>
              </span>
            );
          })}
        </div>
        <textarea
          className={styles.multiSelectTextarea}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            geneSymbolSelections.size === 0
              ? "Enter items, separated by commas or spaces, then press Enter"
              : undefined
          }
          rows={10}
        />
      </div>
      {inValidGeneSymbols.size > 0 && (
        <div className={styles.invalidGenesLegend}>
          <span className={styles.invalidGenesSwatch} />
          <span>= invalid genes</span>
        </div>
      )}
      <div className={styles.buttonRow}>
        <Button
          className={styles.selectGenesButton}
          disabled={inputValue.length === 0}
          onClick={() => {
            const newItems = inputValue
              .split(/[, ]+/)
              .filter((item) => item.trim() !== "");
            setGeneSymbolSelections(
              (prevChips: Set<string>) => new Set([...prevChips, ...newItems])
            ); // Add only unique items
            setInputValue(""); // Clear input
          }}
        >
          Select
        </Button>
        <Button
          className={styles.clearInputButton}
          disabled={inputValue.length === 0}
          onClick={() => {
            setGeneSymbolSelections(() => new Set());
            setValidGeneSymbols(() => new Set());
            setInValidGeneSymbols(() => new Set());
            setInputValue(""); // Clear input
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

export default MultiSelectTextarea;
