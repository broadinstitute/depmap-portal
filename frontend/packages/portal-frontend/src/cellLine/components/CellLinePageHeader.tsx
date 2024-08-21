import React from "react";
import styles from "../styles/CellLinePage.scss";

interface Props {
  strippedCellLineName: string | null;
  publicComments: string | null;
  modelId: string | null;
}

const CellLinePageHeader = ({
  strippedCellLineName,
  publicComments,
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
      {publicComments && publicComments !== "" && (
        <div className={styles.publicComments}>
          <span
            className="glyphicon glyphicon-alert"
            style={{ marginRight: "6px" }}
          ></span>
          {publicComments}
        </div>
      )}
    </div>
  );
};

export default CellLinePageHeader;
