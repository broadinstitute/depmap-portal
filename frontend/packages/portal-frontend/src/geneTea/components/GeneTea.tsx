import React, { useState } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../styles/GeneTea.scss";
import SearchOptionsContainer from "./SearchOptionsContainer";

function GeneTea() {
  const [doGroupTerms, setDoGroupTerms] = useState<boolean>(true);
  const [doClusterGenes, setDoClusterGenes] = useState<boolean>(true);
  const [doClusterTerms, setDoClusterTerms] = useState<boolean>(true);

  const [geneSymbolSelections, setGeneSymbolSelections] = useState<Set<string>>(
    new Set([])
  );

  const [validGeneSymbols, setValidGeneSymbols] = useState<Set<string>>(
    new Set([])
  );
  const [inValidGeneSymbols, setInValidGeneSymbols] = useState<Set<string>>(
    new Set([])
  );

  return (
    <div className={styles.geneTeaGrid}>
      <div className={styles.geneTeaFilters}>
        <SearchOptionsContainer
          handleToggleGroupTerms={setDoGroupTerms}
          handleToggleClusterGenes={setDoClusterGenes}
          handleToggleClusterTerms={setDoClusterTerms}
          handleSetGeneSymbolSelections={setGeneSymbolSelections}
          handleSetInvalidGenes={setInValidGeneSymbols}
          handleSetValidGenes={setValidGeneSymbols}
          allSelections={geneSymbolSelections}
          validSelections={validGeneSymbols}
          invalidSelections={inValidGeneSymbols}
        />
      </div>
      <div className={styles.geneTeaMain}>
        <GeneTeaMainContent
          searchTerms={geneSymbolSelections}
          validGenes={validGeneSymbols}
          invalidGenes={inValidGeneSymbols}
          doGroupTerms={doGroupTerms}
          doClusterGenes={doClusterGenes}
          doClusterTerms={doClusterTerms}
          handleSetGeneSymbolSelections={setGeneSymbolSelections}
          handleSetInvalidGenes={setInValidGeneSymbols}
          handleSetValidGenes={setValidGeneSymbols}
        />
      </div>
    </div>
  );
}

export default GeneTea;
