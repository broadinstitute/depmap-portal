import React, { useState, useMemo } from "react";
import styles from "../../../../../styles/GeneTea.scss";
import ExcerptTable from "../ExcerptTable";
import { Tab, Tabs } from "react-bootstrap";

interface SmallTermGroupProps {
  termsWithinSelectedGroup: string[];
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const SmallTermGroup: React.FC<SmallTermGroupProps> = ({
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

export default SmallTermGroup;
