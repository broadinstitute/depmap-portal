import React from "react";
import { Tab, Tabs } from "react-bootstrap";
import styles from "../../../../styles/GeneTea.scss";
import ExcerptTable from "./ExcerptTable";

interface TermGroupTabsProps {
  termsWithinSelectedGroup: string[];
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const TermGroupTabs: React.FC<TermGroupTabsProps> = ({
  termsWithinSelectedGroup,
  termToMatchingGenesMap,
  useAllGenes,
}) => {
  return (
    <Tabs className={styles.termGroupTabs} id="gene_tea_term_group_terms_tabs">
      {termsWithinSelectedGroup.map((term) => (
        <Tab eventKey={term} title={term} key={term}>
          <ExcerptTable
            useTerms={false} // This component always uses the Term Groups flavor of the ExcerptTable
            term={term}
            termToMatchingGenesMap={termToMatchingGenesMap}
            useAllGenes={useAllGenes}
          />
        </Tab>
      ))}
    </Tabs>
  );
};

export default TermGroupTabs;
