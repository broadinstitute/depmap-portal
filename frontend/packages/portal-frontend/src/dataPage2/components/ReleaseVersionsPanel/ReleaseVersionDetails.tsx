import React from "react";
import { ReleaseVersion } from "@depmap/types";
import styles from "src/dataPage/styles/DataPage.scss";

interface Props {
  versions: ReleaseVersion[];
  selectedVersion: ReleaseVersion;
  onVersionChange: (id: string) => void;
}

const ReleaseVersionDetails = ({
  versions,
  selectedVersion,
  onVersionChange,
}: Props) => {
  return (
    <div className={styles.releaseBody}>
      {versions.length > 1 && (
        <div className={styles.versionSelectorContainer}>
          <label htmlFor={`version-select-${selectedVersion.release_name}`}>
            Version:{" "}
          </label>
          <select
            id={`version-select-${selectedVersion.release_name}`}
            value={selectedVersion.id}
            onChange={(e) => onVersionChange(e.target.value)}
            onClick={(e) => e.stopPropagation()} // Prevent accordion toggle
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version_name} ({v.version_date})
              </option>
            ))}
          </select>
        </div>
      )}

      <section className={styles.releaseDescription}>
        <h4>Description</h4>
        <div
          dangerouslySetInnerHTML={{
            __html: selectedVersion.description || "No description available.",
          }}
        />
      </section>

      {selectedVersion.funding && (
        <section className={styles.funding}>
          <h4>Funding</h4>
          <p>{selectedVersion.funding}</p>
        </section>
      )}
    </div>
  );
};

export default ReleaseVersionDetails;
