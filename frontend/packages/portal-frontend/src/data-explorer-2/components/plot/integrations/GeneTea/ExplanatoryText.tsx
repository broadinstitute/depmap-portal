import React from "react";
import {
  MIN_SELECTION,
  MAX_SELECTION,
} from "src/data-explorer-2/components/plot/integrations/GeneTea/constants";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

interface Props {
  error: boolean;
  noTermsFound: boolean;
  selectMore: boolean;
  selectLess: boolean;
}

function ExplanatoryText({
  error,
  noTermsFound,
  selectMore,
  selectLess,
}: Props) {
  if (error) {
    return (
      <div className={styles.plotInstructions}>
        Sorry, there was an error retrieving enriched terms for the selected
        genes.
      </div>
    );
  }

  if (noTermsFound) {
    return (
      <div className={styles.plotInstructions}>
        (No enriched terms could be found for the selected genes)
      </div>
    );
  }

  if (selectMore) {
    return (
      <div className={styles.plotInstructions}>
        Select {MIN_SELECTION} or more genes to see enriched terms.
      </div>
    );
  }

  if (selectLess) {
    return (
      <div className={styles.plotInstructions}>
        Too many genes selected. Limit your selection to {MAX_SELECTION} genes.
      </div>
    );
  }

  return null;
}

export default ExplanatoryText;
