import React, { useCallback, useEffect, useRef } from "react";
// import { ReleaseVersion } from "@depmap/types";
import {
  ReleaseVersionsProvider,
  useReleaseVersionsContext,
} from "src/dataPageV2/contexts/ReleaseVersionsContext";
// import VersionFileView from "./VersionFileView";
import styles from "src/dataPageV2/styles.scss";
// import Release from "./Release";
import ReleaseVersionsFilterBar from "./ReleaseVersionsFilterBar";

const ReleasesContent: React.FC = () => {
  const {
    groupedReleases,
    isLoading,
    error,
    selectedVersion,
    setSelectedVersion,
  } = useReleaseVersionsContext();

  const savedScrollYRef = useRef<number>(0);
  const wasViewingVersionRef = useRef<boolean>(false);

  // Capture scroll position right before drilling into a version's files
  // const handleViewVersion = useCallback(
  //   (version: ReleaseVersion) => {
  //     savedScrollYRef.current = window.scrollY;
  //     setSelectedVersion(version);
  //   },
  //   [setSelectedVersion]
  // );

  // const handleBackToReleases = useCallback(() => {
  //   setSelectedVersion(null);
  // }, [setSelectedVersion]);

  // Scroll to top when entering VersionFileView; restore saved scroll when returning
  useEffect(() => {
    if (selectedVersion) {
      wasViewingVersionRef.current = true;
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } else if (wasViewingVersionRef.current) {
      wasViewingVersionRef.current = false;
      const targetY = savedScrollYRef.current;
      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetY,
          behavior: "instant" as ScrollBehavior,
        });
      });
    }
  }, [selectedVersion]);

  const releaseEntries = Object.entries(groupedReleases);

  const renderReleasesContent = () => {
    if (isLoading) {
      return <div className={styles.loading}>Updating results...</div>;
    }

    if (error) {
      return (
        <div className={styles.error}>Error loading release versions.</div>
      );
    }

    if (releaseEntries.length === 0) {
      return (
        <div className={styles.emptyState}>
          No releases found matching these filters.
        </div>
      );
    }

    return (
      <div className={styles.ReleaseList}>
        {releaseEntries.map(([name /* , versions */]) => (
          /*           <Release
            key={name}
            releaseName={name}
            versions={versions}
            onViewVersion={setSelectedVersion}
          /> */
          <>{name}</>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.ReleasesPanel}>
      {/* {selectedVersion && (
        <VersionFileView
          version={selectedVersion}
          onBack={handleBackToReleases}
        />
      )} */}

      {/* Keep the release list mounted so card dropdown selections and DOM height stay intact */}
      <div style={{ display: selectedVersion ? "none" : "block" }}>
        <ReleaseVersionsFilterBar />

        {renderReleasesContent()}
      </div>
    </div>
  );
};

const ReleasesPanel: React.FC = () => (
  <ReleaseVersionsProvider syncWithUrl>
    <ReleasesContent />
  </ReleaseVersionsProvider>
);

export default ReleasesPanel;
