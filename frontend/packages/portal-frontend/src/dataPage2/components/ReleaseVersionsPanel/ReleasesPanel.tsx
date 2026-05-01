import React, { useMemo, useState } from "react";
import { ReleaseVersion } from "@depmap/types";
import useReleaseVersions from "src/dataPage2/hooks/useReleaseVersions";
import VersionFileView from "./VersionFileView";
import styles from "src/dataPage/styles/DataPage.scss";
import Release from "./Release";

const ReleasesPanel = () => {
  const { releases, isLoading, error } = useReleaseVersions();
  const [selectedVersion, setSelectedVersion] = useState<ReleaseVersion | null>(
    null
  );

  const groupedReleases = useMemo(() => {
    return releases.reduce((acc, release) => {
      if (!acc[release.release_name]) {
        acc[release.release_name] = [];
      }
      acc[release.release_name].push(release);
      return acc;
    }, {} as Record<string, ReleaseVersion[]>);
  }, [releases]);

  if (selectedVersion) {
    return (
      <VersionFileView
        version={selectedVersion}
        onBack={() => setSelectedVersion(null)}
      />
    );
  }

  if (isLoading)
    return <div className={styles.loading}>Loading release history...</div>;
  if (error) return <div className={styles.error}>Error loading data.</div>;

  return (
    <div className={styles.ReleasesPanel}>
      {Object.entries(groupedReleases).map(([name, versions]) => (
        <Release
          key={name}
          releaseName={name}
          versions={versions}
          onViewVersion={setSelectedVersion}
        />
      ))}
    </div>
  );
};

export default ReleasesPanel;
