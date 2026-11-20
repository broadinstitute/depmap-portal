import React from "react";
import { ReleaseVersion } from "@depmap/types";
import styles from "./VersionHeader.scss";

interface VersionHeaderProps {
  version: ReleaseVersion;
  onBack: () => void;
}

const VersionHeader: React.FC<VersionHeaderProps> = ({ version, onBack }) => {
  const formattedDate = version.version_date
    ? new Date(version.version_date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <>
      <div className={styles.topNavBar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <span className={styles.backArrow} aria-hidden="true">
            ←
          </span>
          <span>Back to Releases</span>
        </button>

        <div className={styles.breadcrumb}>
          <span>Releases</span>
          <span aria-hidden="true">/</span>
          <strong>{version.release_name}</strong>
        </div>
      </div>

      <section aria-label="Release Information" className={styles.overviewCard}>
        <div
          className={`${styles.overviewHeader} ${
            version.description ? styles.withDescription : ""
          }`}
        >
          <div className={styles.overviewTitleGroup}>
            <span className={styles.releaseLabel}>Release</span>
            <h2>{version.release_name}</h2>
            {version.version_name && (
              <span className={styles.versionBadge}>
                {version.version_name}
              </span>
            )}
          </div>

          {formattedDate && (
            <span className={styles.publishedDate}>
              Published {formattedDate}
            </span>
          )}
        </div>

        {version.description && (
          <div
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: version.description }}
          />
        )}
      </section>
    </>
  );
};

export default VersionHeader;
