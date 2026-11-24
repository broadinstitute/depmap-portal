import React, { useState } from "react";
import { ReleaseFile } from "@depmap/types";
import FilesTable from "./FilesTable";
import styles from "./VersionFileView.scss";

interface FileGroupSectionProps {
  title: string;
  subtitle: string;
  files: ReleaseFile[];
  variant?: "primary" | "supplemental";
}

const FileGroupSection: React.FC<FileGroupSectionProps> = ({
  title,
  subtitle,
  files,
  variant = "primary",
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (files.length === 0) return null;

  const badgeClass =
    variant === "primary"
      ? styles.fileGroupCountBadge
      : styles.fileGroupCountBadgeSecondary;

  return (
    <div className={styles.fileGroupSection}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className={`${styles.fileGroupHeader} ${styles.fileGroupHeaderClickable}`}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
      >
        <div className={styles.fileGroupTitleRow}>
          <span
            className={`glyphicon glyphicon-triangle-bottom ${
              styles.fileGroupCaret
            } ${!isExpanded ? styles.fileGroupCaretCollapsed : ""}`}
            aria-hidden="true"
          />
          <h4 className={styles.fileGroupTitle}>{title}</h4>
          <span className={badgeClass}>{files.length}</span>
        </div>
        <span className={styles.fileGroupSubtitle}>{subtitle}</span>
      </div>
      {isExpanded && <FilesTable files={files} />}
    </div>
  );
};

export default FileGroupSection;
