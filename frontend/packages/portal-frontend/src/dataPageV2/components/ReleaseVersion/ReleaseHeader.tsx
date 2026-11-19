import React from "react";
import styles from "./ReleaseHeader.scss";

interface ReleaseHeaderProps {
  releaseName: string;
  dropdownOptions: string[];
  currentSelection: string;
  onSelectVersion: (versionName: string) => void;
  formattedDate: string | null;
}

const ReleaseHeader: React.FC<ReleaseHeaderProps> = ({
  releaseName,
  dropdownOptions,
  currentSelection,
  onSelectVersion,
  formattedDate,
}) => {
  const selectId = `version-select-${releaseName}`;

  return (
    <div className={styles.header}>
      <div className={styles.titleColumn}>
        <h3>{releaseName}</h3>

        <div className={styles.versionSelector}>
          <label htmlFor={selectId}>Version:</label>
          <select
            id={selectId}
            value={currentSelection}
            onChange={(event) => onSelectVersion(event.target.value)}
          >
            {dropdownOptions.map((optionLabel) => (
              <option key={optionLabel} value={optionLabel}>
                {optionLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.metadataGroup}>
        {formattedDate && (
          <span className={styles.releaseDate}>Released {formattedDate}</span>
        )}
      </div>
    </div>
  );
};

export default ReleaseHeader;
