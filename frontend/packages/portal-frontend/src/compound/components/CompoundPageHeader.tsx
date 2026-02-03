import React from "react";
import styles from "../styles/CompoundPage.scss";

interface Props {
  /* props */
}

const CompoundPageHeader = ({}: /* props */ Props): JSX.Element => {
  return (
    <div className={styles.header}>
      <div className={styles.symbol}>{compoundName}</div>
      <div className={styles.headerInfoContainer}>
        <div className={styles.headerInfoContainer}>
          {aka && (
            <div className={styles.otherInfo}>
              Also known as: <span className={styles.infoContent}>{aka}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompoundPageHeader;
