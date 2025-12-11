import React, { useState, useMemo } from "react";
import { Tab, Tabs } from "react-bootstrap";
import Select from "react-select";
import styles from "../../../../styles/GeneTea.scss";
import ExcerptTable from "./ExcerptTable";

const TERM_THRESHOLD = 10;

interface TermGroupTabsProps {
  termGroup: string;
  termsWithinSelectedGroup: string[];
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const TermGroupTabs: React.FC<TermGroupTabsProps> = ({
  termGroup,
  termsWithinSelectedGroup,
  termToMatchingGenesMap,
  useAllGenes,
}) => {
  const isLargeGroup = termsWithinSelectedGroup.length > TERM_THRESHOLD;

  const termSelectOptions: { value: string; label: string }[] = useMemo(
    () =>
      termsWithinSelectedGroup.map((term) => ({
        value: term,
        label: term,
      })),
    [termsWithinSelectedGroup]
  );

  // 2. State to manage the selected term (used in both dropdown and tabs)
  // Initialize with the first term in the group
  const [selectedTerm, setSelectedTerm] = useState<{
    value: string;
    label: string;
  } | null>(termSelectOptions[0]);

  if (isLargeGroup) {
    // Mode for > 10 Terms: Show Dropdown and single ExcerptTable
    return (
      <div className={styles.largeGroupContainer}>
        {/* 3. Dropdown (Never Hidden) */}
        <h4>
          There are {termSelectOptions.length} terms within {termGroup}. Choose
          a term to load the gene excerpts.
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
  }
  // Mode for <= 10 Terms: The Tabs component implicitly manages the active tab key.

  return (
    <>
      {selectedTerm && (
        <Tabs
          className={styles.termGroupTabs}
          id="gene_tea_term_group_terms_tabs"
          // Ensure the tabs are still controlled, defaulting to the first term
          activeKey={selectedTerm.value}
          onSelect={(key) => {
            // Find the full option object and set it to state for consistency
            const selectedOption = termSelectOptions.find(
              (opt) => opt.value === key
            );
            if (selectedOption) {
              setSelectedTerm(selectedOption);
            }
          }}
        >
          {termsWithinSelectedGroup.map((term) => (
            <Tab eventKey={term} title={term} key={term}>
              <div className={styles.tabContent}>
                {selectedTerm.value === term && (
                  <ExcerptTable
                    key={term}
                    useTerms={false}
                    term={term}
                    termToMatchingGenesMap={termToMatchingGenesMap}
                    useAllGenes={useAllGenes}
                  />
                )}
              </div>
            </Tab>
          ))}
        </Tabs>
      )}
    </>
  );
};

export default TermGroupTabs;
