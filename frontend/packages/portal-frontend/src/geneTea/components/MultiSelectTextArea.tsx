import React, { useState } from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/MultiSelectTextArea.scss";
import { useGeneTeaContext } from "../context/GeneTeaContext";

const MultiSelectTextarea: React.FC = () => {
  const {
    geneSymbolSelections,
    handleSetGeneSymbolSelections,
    validGeneSymbols,
    handleSetValidGeneSymbols,
    inValidGeneSymbols,
    handleSetInValidGeneSymbols,
    handleClearPlotSelection,
    handleClearSelectedTableRows,
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
      handleSetGeneSymbolSelections(
        (prevChips: Set<string>) => new Set([...prevChips, ...newItems])
      ); // Add only unique items
      setInputValue(""); // Clear input
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    handleSetGeneSymbolSelections(
      (prevChips: Set<string>) =>
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
          style={{
            border: "none",
            resize: "none",
            width: "100%",
            height: "100%",
          }}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            geneSymbolSelections.size === 0
              ? "Enter items, separated by commas or spaces, then press Enter"
              : undefined
          }
          rows={5}
        />
      </div>
      {validGeneSymbols.size > 0 && (
        <div className={styles.validGenesLegend}>
          <span className={styles.validGenesSwatch} />
          <span>= valid genes ({validGeneSymbols.size})</span>
        </div>
      )}
      {inValidGeneSymbols.size > 0 && (
        <div className={styles.invalidGenesLegend}>
          <span className={styles.invalidGenesSwatch} />
          <span>= invalid genes ({inValidGeneSymbols.size})</span>
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
            handleSetGeneSymbolSelections(
              (prevChips: Set<string>) => new Set([...prevChips, ...newItems])
            ); // Add only unique items
            setInputValue(""); // Clear input
          }}
        >
          Select
        </Button>
        <Button
          className={styles.clearInputButton}
          disabled={inputValue.length === 0 && geneSymbolSelections.size === 0}
          onClick={() => {
            handleSetGeneSymbolSelections(() => new Set<string>([]));
            handleSetValidGeneSymbols(new Set());
            handleSetInValidGeneSymbols(new Set());
            handleClearPlotSelection();
            handleClearSelectedTableRows();
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
