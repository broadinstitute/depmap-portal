import React, { useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/MultiSelectTextArea.scss";
import { useGeneTeaContext } from "../context/GeneTeaContext";
import { MAX_GENES_ALLOWED } from "../types";

const MultiSelectTextarea: React.FC = () => {
  const {
    geneSymbolSelections,
    handleSetGeneSymbolSelections,
    validGeneSymbols,
    handleSetValidGeneSymbols,
    inValidGeneSymbols,
    handleSetInValidGeneSymbols,
    selectedPlotGenes,
    handleSetPlotSelectedGenes,
    handleClearPlotSelection,
    handleClearSelectedTableRows,
    handleSetError,
    error,
    errorMessage,
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
    } else if (e.key === "Enter" && inputValue.trim() === "") {
      e.preventDefault();
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    handleSetGeneSymbolSelections((prevChips: Set<string>) => {
      const newGeneSymbolSelections = new Set(
        [...prevChips].filter((chip) => chip !== chipToRemove)
      );
      return newGeneSymbolSelections;
    });

    // Update Plot Selections panel in case a selected plot gene is no longer valid.
    if (selectedPlotGenes.has(chipToRemove)) {
      const newSelections = [...selectedPlotGenes].filter(
        (geneSymbol) => geneSymbol !== chipToRemove
      );
      handleSetPlotSelectedGenes(new Set(newSelections), false);
    }
  };

  const targetRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Scroll to the element once the component mounts or the `items` change.
    if (targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [inputValue]); // Re-run the effect if the items array changes.

  return (
    <div className={styles.multiSelectTextareaContainer}>
      <h4 className={styles.sectionTitle}>Enter Gene Symbols</h4>
      {geneSymbolSelections.size < 3 && (
        <h5 className={styles.sectionSubTitle}>
          Please enter between 3 and 1000 gene symbols.
        </h5>
      )}
      <div
        className={styles.multiSelectTextareaBorder}
        style={{
          border:
            geneSymbolSelections.size > MAX_GENES_ALLOWED
              ? "2px solid #b00020"
              : "1px solid #ccc",
        }}
      >
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
                  type="button"
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
          ref={targetRef}
          className={styles.multiSelectTextarea}
          style={{
            border: "none",
            resize: "none",
            width: "100%",
            height: "100%",
            scrollMargin: 80,
          }}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            geneSymbolSelections.size === 0
              ? "Enter gene symbols, separated by commas or spaces, then press Enter"
              : undefined
          }
          rows={2}
        />
      </div>
      {geneSymbolSelections.size <= MAX_GENES_ALLOWED &&
        validGeneSymbols.size > 0 && (
          <div className={styles.validGenesLegend}>
            <span className={styles.validGenesSwatch} />
            <span>= valid genes ({validGeneSymbols.size})</span>
          </div>
        )}
      {geneSymbolSelections.size <= MAX_GENES_ALLOWED &&
        inValidGeneSymbols.size > 0 && (
          <div className={styles.invalidGenesLegend}>
            <span className={styles.invalidGenesSwatch} />
            <span>= invalid genes ({inValidGeneSymbols.size})</span>
          </div>
        )}
      {geneSymbolSelections.size > MAX_GENES_ALLOWED && error && (
        <div className={styles.tooManySymbols}>
          <span className="glyphicon glyphicon-exclamation-sign" />{" "}
          {errorMessage}
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
            handleSetError(false);
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

export default MultiSelectTextarea;
