import React from "react";
import { ReleaseVersion } from "@depmap/types";
import { useVersionFiles } from "./useVersionFiles";
import { useFilteredReleaseFiles } from "./useFilteredReleaseFiles";
import VersionHeader from "./VersionHeader";
import DataTags from "./DataTags";
import FilesFilterToolbar from "./FilesFilterToolbar";
import FileGroupSection from "./FileGroupSection";
import FilesTable from "./FilesTable";
import styles from "./VersionFileView.scss";

interface VersionFileViewProps {
  version: ReleaseVersion;
  onBack: () => void;
}

const VersionFileView: React.FC<VersionFileViewProps> = ({
  version,
  onBack,
}) => {
  const { files, isLoading, errorMessage } = useVersionFiles(version);
  const {
    searchQuery,
    setSearchQuery,
    selectedDatatype,
    setSelectedDatatype,
    datatypeTabs,
    filteredFiles,
    primaryFiles,
    secondaryFiles,
    hasActiveFilters,
    resetFilters,
  } = useFilteredReleaseFiles(files);

  return (
    <div className={styles.container}>
      <VersionHeader version={version} onBack={onBack} />
      <hr className={styles.sectionDivider} />

      {isLoading ? (
        <div className={styles.loadingState}>Loading release files...</div>
      ) : errorMessage ? (
        <div className={styles.errorState}>{errorMessage}</div>
      ) : (
        <section
          aria-label="Files by Data Tag"
          className={styles.filesWorkspace}
        >
          <div className={styles.filesWorkspaceHeader}>
            <div className={styles.workspaceTitleRow}>
              <div className={styles.workspaceTitleGroup}>
                <h3 className={styles.workspaceTitle}>Files by Data Tag</h3>
                <span className={styles.workspaceSubtitle}>
                  Select a data tag to filter files
                </span>
              </div>
            </div>

            <DataTags
              totalFilesCount={files.length}
              tabs={datatypeTabs}
              selectedDatatype={selectedDatatype}
              onSelectDatatype={setSelectedDatatype}
            />
          </div>

          <FilesFilterToolbar
            totalCount={files.length}
            filteredCount={filteredFiles.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
          />

          <div role="tabpanel" className={styles.fileGroupsContainer}>
            {filteredFiles.length === 0 ? (
              <FilesTable files={[]} />
            ) : (
              <>
                <FileGroupSection
                  title="Primary Files"
                  subtitle="Core release datasets and primary matrices"
                  files={primaryFiles}
                  variant="primary"
                />
                <FileGroupSection
                  title="Supplemental Files"
                  subtitle="Supporting metadata, mappings, and auxiliary files"
                  files={secondaryFiles}
                  variant="supplemental"
                />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default VersionFileView;
