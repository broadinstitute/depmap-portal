import React from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import styles from "../../../../styles/DataExplorer2.scss";

interface Props {
  term: string;
  synonyms: string[];
  coincident: string[];
  onClick?: () => void;
}

// See https://docs.google.com/document/d/17WI2yalNu5eAmBKj2otcjKFkNHoK5fqcNldJB6VAF0g/edit
function GeneTeaTerm({
  term,
  synonyms,
  coincident,
  onClick = undefined,
}: Props) {
  let tooltip: React.ReactNode = null;

  if (synonyms.length === 1) {
    tooltip = (
      <div>
        Member of synonym set
        <br />
        <WordBreaker text={synonyms[0]} />
      </div>
    );
  }

  if (synonyms.length > 1) {
    tooltip = (
      <div>
        <div>Includes synonymous terms:</div>
        <div>
          {synonyms.map((synonym) => (
            <div key={synonym}>
              <span>• </span>
              <WordBreaker text={synonym} />
              <br />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (coincident.length === 1) {
    tooltip = (
      <div>
        Member of coincident set
        <br />
        <WordBreaker text={coincident[0]} />
      </div>
    );
  }

  if (coincident.length > 1) {
    tooltip = (
      <div>
        <div>Includes coincident terms:</div>
        <div>
          {coincident.map((cTerm) => (
            <div key={cTerm}>
              <span>• </span>
              <WordBreaker text={cTerm} />
              <br />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const MaybeTooltip = ({ children }: { children: React.ReactNode }) => {
    if (!tooltip) {
      return children;
    }

    return (
      <Tooltip
        id="genetea-term-tooltip"
        content={tooltip}
        placement={onClick ? "top" : "bottom"}
      >
        {children}
      </Tooltip>
    );
  };

  return (
    <MaybeTooltip>
      {onClick ? (
        <button className={styles.geneTeaTerm} type="button" onClick={onClick}>
          <WordBreaker text={term} />
        </button>
      ) : (
        <span>
          <WordBreaker text={term} />
        </span>
      )}
    </MaybeTooltip>
  );
}

export default GeneTeaTerm;
