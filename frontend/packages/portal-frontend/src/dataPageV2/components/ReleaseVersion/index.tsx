import React from "react";
import { ReleaseVersion } from "@depmap/types";
import dataPageStyles from "src/dataPageV2/styles.scss";
import { useReleaseVersion } from "./useReleaseVersion";
import ReleaseHeader from "./ReleaseHeader";
import styles from "./Release.scss";
import ReleaseBody from "./ReleaseBody";

interface ReleaseProps {
  releaseName: string;
  versions: ReleaseVersion[];
  onViewVersion: (version: ReleaseVersion) => void;
  keySuffix?: number;
}

const Release: React.FC<ReleaseProps> = ({
  releaseName,
  versions,
  onViewVersion,
}) => {
  const {
    dropdownOptions,
    currentSelection,
    setSelectedOption,
    activeVersion,
    formattedDate,
  } = useReleaseVersion(versions);

  return (
    <div className={`${dataPageStyles.Release} ${styles.releaseCard}`}>
      <ReleaseHeader
        releaseName={releaseName}
        dropdownOptions={dropdownOptions}
        currentSelection={currentSelection}
        onSelectVersion={setSelectedOption}
        formattedDate={formattedDate}
      />

      {activeVersion && (
        <ReleaseBody
          version={activeVersion}
          currentSelection={currentSelection}
          onViewVersion={onViewVersion}
        />
      )}
    </div>
  );
};

export default Release;
