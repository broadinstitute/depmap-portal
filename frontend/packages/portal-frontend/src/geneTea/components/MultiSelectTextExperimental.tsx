import React, { forwardRef, KeyboardEventHandler, Ref, useState } from "react";
import { Button } from "react-bootstrap";
import styles from "../styles/MultiSelectTextArea.scss";
import { useGeneTeaContext } from "../context/GeneTeaContext";
import CreatableSelect from "react-select/creatable";
import { useCallback } from "react";

interface Option {
  readonly label: string;
  readonly value: string;
}

type ForwardedInputProps<Option, IsMulti extends boolean> = any & {
  parentValue: Option[];
  inputValue: string;
  onChange: (value: string, actionMeta: any) => void;
  onKeyDown: (e: any) => any;
  onInputChange: (newValue: any) => void;
};

const CustomTextareaInput = forwardRef(
  <Option, IsMulti extends boolean>(
    {
      parentValue,
      onInputChange,
      onKeyDown,
      onChange,
      inputValue,
      ...rest
    }: ForwardedInputProps<Option, IsMulti>,
    ref: Ref<HTMLTextAreaElement>
  ) => {
    return (
      <textarea
        ref={ref}
        value={inputValue}
        onKeyDown={onKeyDown}
        onChange={onChange}
        onInputChange={onInputChange}
        {...rest}
        style={{
          width: "100%",
          height: "100%",
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          overflow: "hidden",
          flexGrow: 1,
          boxSizing: "border-box",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          ...rest.style,
        }}
      />
    );
  }
) as React.ForwardRefExoticComponent<
  ForwardedInputProps<any, any> & React.RefAttributes<HTMLTextAreaElement>
>;

const customStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: "220px",
    height: "220px", // Set explicit height
    width: "220px", // Set explicit width
    flexWrap: "wrap",
    alignItems: "flex-start", // Align content to the top
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    height: "100%",
    overflowY: "auto",
    padding: "8px",
    flexWrap: "wrap",
    alignItems: "flex-start",
  }),

  input: (provided: any) => ({
    ...provided,
    padding: "0",
    margin: "0",
    height: "100%",
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignSelf: "stretch",
    background: "transparent",
  }),
  placeholder: (base: any) => {
    return {
      ...base,
      display: "none",
    };
  },
  multiValue: (provided: any) => ({
    ...provided,
    whiteSpace: "normal",
    wordBreak: "break-word",
  }),
};

const createOption = (label: string) => ({
  label,
  value: label,
});

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
  const [value, setValue] = React.useState<readonly Option[]>([]);

  const handleKeyDown: KeyboardEventHandler = (e) => {
    if (!inputValue) return;
    switch (e.key) {
      case "Enter":
        e.preventDefault(); // Prevent newline in textarea
        const newItems = inputValue
          .split(/[, ]+/)
          .filter((item) => item.trim() !== "");
        setValue((prev) => {
          const newVals = Array.from(
            new Set([...prev, ...newItems.map((item) => createOption(item))])
          );

          return newVals;
        });
        setInputValue(""); // Clear input
        handleSetGeneSymbolSelections(
          (prevChips: Set<string>) => new Set([...prevChips, ...newItems])
        ); // Add only unique items
    }
  };

  const onChange = useCallback((newValue: any, action: any) => {
    if (newValue && action.action === "remove-value") {
      handleSetGeneSymbolSelections(
        new Set(newValue.map((val: Option) => val.value))
      );
      setValue(newValue);
    } else if (!newValue || action.action === "clear") {
      handleSetGeneSymbolSelections(() => new Set<string>([]));
      handleSetValidGeneSymbols(new Set());
      handleSetInValidGeneSymbols(new Set());
      handleClearPlotSelection();
      handleClearSelectedTableRows();
      setValue([]); // Clear input
    }
  }, []);

  return (
    <div className={styles.multiSelectTextareaContainer}>
      <h4 className={styles.sectionTitle}>Enter Gene Symbols</h4>
      <CreatableSelect
        styles={customStyles}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        value={value}
        // Override the default Input component
        components={{
          Input: React.memo(CustomTextareaInput),
          DropdownIndicator: null as any,
        }}
        // For handling text wrapping inside the input field
        getOptionLabel={(option) => option.label}
        inputValue={inputValue}
        isClearable
        isMulti
        menuIsOpen={false}
        onInputChange={(newValue) => setInputValue(newValue)}
      />
      <div className={styles.buttonRow}>
        <Button
          className={styles.selectGenesButton}
          disabled={inputValue.length === 0}
          onClick={() => {
            const newItems = inputValue
              .split(/[, ]+/)
              .filter((item) => item.trim() !== "");
            setValue((prev) => {
              const newVals = Array.from(
                new Set([
                  ...prev,
                  ...newItems.map((item) => createOption(item)),
                ])
              );

              return newVals;
            });
            setInputValue(""); // Clear input
            handleSetGeneSymbolSelections(
              (prevChips: Set<string>) => new Set([...prevChips, ...newItems])
            ); // Add only unique items
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
            setValue([]);
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

export default MultiSelectTextarea;
