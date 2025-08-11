import React, { useState } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../styles/GeneTea.scss";
import SearchOptions from "./SearchOptionsContainer";

function GeneTea() {
  const [searchTerms, setSearchTerms] = useState<Set<string>>(
    new Set(["CAD", "UMPS", "ADSL", "DHODH"])
  );

  const [doGroupTerms, setDoGroupTerms] = useState<boolean>(true);
  const [doClusterGenes, setDoClusterGenes] = useState<boolean>(true);
  const [doClusterTerms, setDoClusterTerms] = useState<boolean>(true);

  return (
    <div className={styles.geneTeaGrid}>
      <div className={styles.geneTeaFilters}>
        <SearchOptions />
      </div>
      <div className={styles.geneTeaMain}>
        <GeneTeaMainContent
          searchTerms={searchTerms}
          doGroupTerms={doGroupTerms}
          doClusterGenes={doClusterGenes}
          doClusterTerms={doClusterTerms}
        />
      </div>
    </div>
  );
}

export default GeneTea;
