import { ToggleSwitch } from "@depmap/common-components";
import React, { useState } from "react";
import Select from "react-select";
import styles from "../styles/GeneTea.scss";

const MultiSelectTextarea = () => {
  const [inputValue, setInputValue] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const handleInputChange = (e: any) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter" && inputValue.trim() !== "") {
      e.preventDefault(); // Prevent newline in textarea
      const newItems = inputValue
        .split(/[, ]+/)
        .filter((item) => item.trim() !== "");
      setChips((prevChips) => [...new Set([...prevChips, ...newItems])]); // Add only unique items
      setInputValue(""); // Clear input
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    setChips((prevChips) => prevChips.filter((chip) => chip !== chipToRemove));
  };

  return (
    <div style={{ backgroundColor: "white" }}>
      <div
        style={{
          position: "relative",
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "5px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
            backgroundColor: "white",
          }}
        >
          {chips.map((chip, index) => (
            <span
              key={index}
              style={{
                background: "#e0e0e0",
                padding: "3px 8px",
                borderRadius: "15px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {chip}
              <button
                onClick={() => handleRemoveChip(chip)}
                style={{
                  marginLeft: "5px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                x
              </button>
            </span>
          ))}
        </div>
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            chips.length === 0
              ? "Enter items, separated by commas or spaces, then press Enter"
              : undefined
          }
          rows={15}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "vertical",
          }}
        />
      </div>
    </div>
  );
};

interface SearchOptionsContainerProps {
  handleToggleGroupTerms: (nextValue: boolean) => void;
  handleToggleClusterGenes: (nextValue: boolean) => void;
  handleToggleClusterTerms: (nextValue: boolean) => void;
}

function SearchOptionsContainer({
  handleToggleGroupTerms,
  handleToggleClusterGenes,
  handleToggleClusterTerms,
}: SearchOptionsContainerProps) {
  return (
    <div className={styles.SearchOptionsContainer}>
      <h4 className={styles.sectionTitle}>Enter Gene Symbols</h4>
      <MultiSelectTextarea />
      <hr className={styles.SearchOptionsContainerHr} />
      <h4 className={styles.sectionTitle} style={{ paddingBottom: "4px" }}>
        Filter by TEMP
      </h4>
      <Select
        defaultValue={{ label: "temp0", value: "temp0" }}
        isDisabled={false}
        isMulti
        options={[
          { label: "temp0", value: "temp0" },
          { label: "temp1", value: "temp1" },
        ]}
        onChange={(value: any) => {
          if (value) {
            console.log("changed to ", value);
          }
        }}
        id="gene-tea-filter-by-TEMP"
      />
      <hr className={styles.SearchOptionsContainerHr} />
      <h4 className={styles.sectionTitle}>TEMP LABEL View Options</h4>
      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>TEMP TOGGLE</div>
        <ToggleSwitch
          value={true}
          onChange={(val) => console.log("CHANGED", val)}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>
    </div>
  );
}

export default SearchOptionsContainer;
