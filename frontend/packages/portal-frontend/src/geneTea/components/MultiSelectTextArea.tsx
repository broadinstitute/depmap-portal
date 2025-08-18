import React, { useState } from "react";
import { Button } from "react-bootstrap";
import styles from "./MultiSelectTextArea.scss";

interface Props {
  handleSetGeneSymbolSelections: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
  handleSetValidGenes: (selections: React.SetStateAction<Set<string>>) => void;
  handleSetInvalidGenes: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
  allSelections: Set<string>;
}

const MultiSelectTextarea: React.FC<Props> = ({
  handleSetGeneSymbolSelections,
  handleSetValidGenes,
  handleSetInvalidGenes,
  allSelections,
}: Props) => {
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
      (prevChips) =>
        new Set([...prevChips].filter((chip) => chip !== chipToRemove))
    );
  };

  return (
    <div className={styles.multiSelectTextareaContainer}>
      <div className={styles.multiSelectTextareaBorder}>
        <div className={styles.chipList}>
          {[...allSelections].map((chip, index) => (
            <span className={styles.chip} key={index}>
              {chip}
              <button
                className={styles.chipRemoveButton}
                onClick={() => handleRemoveChip(chip)}
              >
                x
              </button>
            </span>
          ))}
        </div>
        <textarea
          className={styles.multiSelectTextarea}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            allSelections.size === 0
              ? "Enter items, separated by commas or spaces, then press Enter"
              : undefined
          }
          rows={10}
        />
      </div>
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
          disabled={inputValue.length === 0}
          onClick={() => {
            handleSetGeneSymbolSelections(() => new Set());
            handleSetValidGenes(() => new Set());
            handleSetInvalidGenes(() => new Set());
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
