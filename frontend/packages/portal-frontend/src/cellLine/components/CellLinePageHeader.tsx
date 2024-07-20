import React from "react";
import styles from "../styles/CellLinePage.scss";

interface Props {
  strippedCellLineName: string | null;
  modelId: string | null;
}

const CellLinePageHeader = ({
  strippedCellLineName,
  modelId,
}: Props): JSX.Element => {
  return (
    <div className={styles.header}>
      <div className={styles.displayName}>{strippedCellLineName}</div>
      <div className={styles.identifiers}>
        {modelId && (
          <span>
            DepMap ID: <strong>{modelId}</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default CellLinePageHeader;
