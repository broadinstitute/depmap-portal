import React, { useState } from "react";
import { ReleaseVersion } from "@depmap/types";
import ReleaseVersionDetails from "./ReleaseVersionDetails";
import styles from "src/dataPage/styles/DataPage.scss";
import { CollapsiblePanel } from "src/dataPage/components/CollapsiblePanel";

interface Props {
  releaseName: string;
  versions: ReleaseVersion[];
  onViewVersion: (version: ReleaseVersion) => void;
}

// This component manages the state for which version is currently active within a specific release name.
const Release = ({ releaseName, versions, onViewVersion }: Props) => {
  const [selectedId, setSelectedId] = useState(versions[0].id);
  const currentVersion =
    versions.find((v) => v.id === selectedId) || versions[0];

  const header = (
    <div className={styles.releaseHeaderLayout}>
      <div className={styles.releaseTitle}>
        <strong className={styles.mainName}>{releaseName}</strong>
        <span className={styles.versionName}>
          {currentVersion.version_name}
        </span>
      </div>
      <div className={styles.releaseDate}>{currentVersion.version_date}</div>
    </div>
  );

  return (
    <div className={styles.releaseGroupWrapper}>
      <CollapsiblePanel
        headerContent={header}
        bodyContent={
          <ReleaseVersionDetails
            versions={versions}
            selectedVersion={currentVersion}
            onVersionChange={setSelectedId}
          />
        }
      />
    </div>
  );
};

export default Release;
