import React from "react";
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
  if (files.length === 0) return null;

  const badgeClass =
    variant === "primary"
      ? styles.fileGroupCountBadge
      : styles.fileGroupCountBadgeSecondary;

  return (
    <div className={styles.fileGroupSection}>
      <div className={styles.fileGroupHeader}>
        <div className={styles.fileGroupTitleRow}>
          <h4 className={styles.fileGroupTitle}>{title}</h4>
          <span className={badgeClass}>{files.length}</span>
        </div>
        <span className={styles.fileGroupSubtitle}>{subtitle}</span>
      </div>
      <FilesTable files={files} />
    </div>
  );
};

export default FileGroupSection;
