import React from "react";
import styles from "../styles/VersionBadge.scss";

interface VersionBadgeProps {
  versionNumber: number;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  versionNumber,
}) => {
  return (
    <div className={styles.badgeContainer} title={`Version ${versionNumber}`}>
      <span className={styles.vPrefix}>v</span>
      <span className={styles.versionNumber}>{versionNumber}</span>
    </div>
  );
};
