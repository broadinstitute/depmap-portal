import React, { useState, useMemo } from "react";
import Select from "react-select";
import styles from "../../../../../styles/GeneTea.scss";
import ExcerptTable from "../ExcerptTable";

interface LargeTermGroupProps {
  termGroup: string;
  termsWithinSelectedGroup: string[];
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const LargeTermGroup: React.FC<LargeTermGroupProps> = ({
  termGroup,
  termsWithinSelectedGroup,
  termToMatchingGenesMap,
  useAllGenes,
}) => {
  const termSelectOptions: { value: string; label: string }[] = useMemo(
    () =>
      termsWithinSelectedGroup.map((term) => ({
        value: term,
        label: term,
      })),
    [termsWithinSelectedGroup]
  );

  const [selectedTerm, setSelectedTerm] = useState<{
    value: string;
    label: string;
  } | null>(termSelectOptions[0]);

  // Mode for > 10 Terms: Show Dropdown and single ExcerptTable
  return (
    <div className={styles.largeGroupContainer}>
      {/* 3. Dropdown (Never Hidden) */}
      <h4>
        There are {termSelectOptions.length} terms within {termGroup}. Choose a
        term to load the gene excerpts.
      </h4>
      <div className={styles.termSelector}>
        <Select
          options={termSelectOptions}
          value={
            selectedTerm
              ? { value: selectedTerm.value, label: selectedTerm.label }
              : null
          }
          onChange={(selection: any) => {
            if (selection) {
              setSelectedTerm({
                value: selection.value,
                label: selection.label,
              });
            }
          }}
          placeholder={`Select one of the ${termsWithinSelectedGroup.length} terms...`}
          // Ensure the dropdown is always wide enough
          styles={{ control: (base) => ({ ...base, minWidth: "300px" }) }}
        />
      </div>
      <hr />

      {/* 4. Excerpt Table for the selected term */}
      {selectedTerm && (
        <ExcerptTable
          key={selectedTerm.value}
          useTerms={false}
          term={selectedTerm.value} // Use the term from the selected state
          termToMatchingGenesMap={termToMatchingGenesMap}
          useAllGenes={useAllGenes}
        />
      )}
    </div>
  );
};

export default LargeTermGroup;
