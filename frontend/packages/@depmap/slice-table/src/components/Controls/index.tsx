import React from "react";
import { Button } from "react-bootstrap";
import SearchBar from "./SearchBar";
import styles from "../../styles/SliceTable.scss";

interface Props {
  tableRef: React.RefObject<{
    goToNextMatch: () => void;
    goToPreviousMatch: () => void;
    readonly currentMatchIndex: number;
    readonly totalMatches: number;
    readonly searchQuery: string;
    setSearchQuery: (query: string) => void;
    subscribeToSearch: (listener: () => void) => () => void;
  }>;
  isLoading: boolean;
  hadError: boolean;
  onClickFilterButton: () => void;
  onClickDownload: () => void;
  renderCustomControls: () => React.ReactNode;
  numFiltersApplied: number;
}

function Controls({
  tableRef,
  isLoading,
  hadError,
  onClickFilterButton,
  onClickDownload,
  renderCustomControls,
  numFiltersApplied,
}: Props) {
  return (
    <div className={styles.Controls}>
      <div className={styles.customControls}>{renderCustomControls()}</div>
      <div className={styles.search}>
        <SearchBar tableRef={tableRef} />
      </div>
      <div className={styles.filterAndDownload}>
        <Button
          onClick={onClickFilterButton}
          bsSize="small"
          disabled={isLoading || hadError}
        >
          <i className="glyphicon glyphicon-filter" />
          <span> Filters</span>
          {numFiltersApplied > 0 && (
            <span className={styles.filterBadge}>{numFiltersApplied}</span>
          )}
        </Button>
        <Button
          onClick={onClickDownload}
          bsSize="small"
          disabled={isLoading || hadError}
        >
          <i className="glyphicon glyphicon-download-alt" />
          <span> Download data</span>
        </Button>
      </div>
    </div>
  );
}

export default Controls;
