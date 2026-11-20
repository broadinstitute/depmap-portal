import React from "react";
import styles from "./VersionFileView.scss";

interface FilesFilterToolbarProps {
  totalCount: number;
  filteredCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

const FilesFilterToolbar: React.FC<FilesFilterToolbarProps> = ({
  totalCount,
  filteredCount,
  searchQuery,
  onSearchChange,
  hasActiveFilters,
  onResetFilters,
}) => {
  return (
    <div className={styles.filterToolbar}>
      <div className={styles.searchGroup}>
        <label htmlFor="file-search-input" className={styles.filterLabel}>
          Search Files
        </label>
        <input
          id="file-search-input"
          type="text"
          className={styles.searchInput}
          placeholder="Search by file name or description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={styles.toolbarActions}>
        <span className={styles.resultCountPill}>
          Showing <strong>{filteredCount}</strong> of {totalCount}{" "}
          {totalCount === 1 ? "file" : "files"}
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            className={styles.resetButton}
            onClick={onResetFilters}
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
};

export default FilesFilterToolbar;
