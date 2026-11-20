import React, { useEffect, useMemo, useState } from "react";
import { ReleaseVersion } from "@depmap/types";
import {
  ALL_DATATYPES_OPTION,
  matchesFileFilters,
  useVersionFiles,
} from "./useVersionFiles";
import VersionHeader from "./VersionHeader";
import FilesFilterToolbar from "./FilesFilterToolbar";
import FilesTable from "./FilesTable";
import styles from "./VersionFileView.scss";

interface VersionFileViewProps {
  version: ReleaseVersion;
  onBack: () => void;
}

const TagIcon: React.FC = () => (
  <span
    className={`glyphicon glyphicon-tag ${styles.tagIcon}`}
    aria-hidden="true"
  />
);

const VersionFileView: React.FC<VersionFileViewProps> = ({
  version,
  onBack,
}) => {
  const { files, isLoading, errorMessage } = useVersionFiles(version);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDatatype, setSelectedDatatype] = useState<string>(
    ALL_DATATYPES_OPTION
  );

  const datatypeTabs = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((file) => {
      const uniqueFileTypes = new Set(
        (file.datatypes ?? []).filter((dt): dt is string => Boolean(dt))
      );
      uniqueFileTypes.forEach((datatype) => {
        counts.set(datatype, (counts.get(datatype) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([datatype, count]) => ({
        value: datatype,
        label: datatype,
        count,
      }));
  }, [files]);

  useEffect(() => {
    if (
      selectedDatatype !== ALL_DATATYPES_OPTION &&
      !datatypeTabs.some((tab) => tab.value === selectedDatatype)
    ) {
      setSelectedDatatype(ALL_DATATYPES_OPTION);
    }
  }, [datatypeTabs, selectedDatatype]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return files.filter((file) =>
      matchesFileFilters(file, selectedDatatype, normalizedQuery)
    );
  }, [files, selectedDatatype, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedDatatype !== ALL_DATATYPES_OPTION;

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedDatatype(ALL_DATATYPES_OPTION);
  };

  const renderFilesPanel = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingState}>Loading release files...</div>
      );
    }

    if (errorMessage) {
      return <div className={styles.errorState}>{errorMessage}</div>;
    }

    return (
      <section aria-label="Files by Data Tag" className={styles.filesWorkspace}>
        <div className={styles.filesWorkspaceHeader}>
          <div className={styles.workspaceTitleRow}>
            <div className={styles.workspaceTitleGroup}>
              <h3 className={styles.workspaceTitle}>Files by Data Tag</h3>
              <div>
                <span className={styles.workspaceSubtitle}>
                  Select a data tag to filter files
                </span>
              </div>
            </div>
          </div>

          {datatypeTabs.length > 0 && (
            <div
              role="tablist"
              aria-label="Files by Data Tag"
              className={styles.datatypeTabsBar}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedDatatype === ALL_DATATYPES_OPTION}
                className={`${styles.datatypeTab} ${
                  selectedDatatype === ALL_DATATYPES_OPTION
                    ? styles.datatypeTabActive
                    : ""
                }`}
                onClick={() => setSelectedDatatype(ALL_DATATYPES_OPTION)}
              >
                <span>All Files</span>
                <span className={styles.tabCountBadge}>{files.length}</span>
              </button>

              {datatypeTabs.map((tab) => {
                const isActive = selectedDatatype === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.datatypeTab} ${
                      isActive ? styles.datatypeTabActive : ""
                    }`}
                    onClick={() => setSelectedDatatype(tab.value)}
                  >
                    <TagIcon />
                    <span>{tab.label}</span>
                    <span className={styles.tabCountBadge}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <FilesFilterToolbar
          totalCount={files.length}
          filteredCount={filteredFiles.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />

        <div role="tabpanel">
          <FilesTable files={filteredFiles} />
        </div>
      </section>
    );
  };

  return (
    <div className={styles.container}>
      <VersionHeader version={version} onBack={onBack} />
      <hr className={styles.sectionDivider} />
      {renderFilesPanel()}
    </div>
  );
};

export default VersionFileView;
