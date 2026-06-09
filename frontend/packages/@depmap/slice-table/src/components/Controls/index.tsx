import React from "react";
import cx from "classnames";
import { Button } from "react-bootstrap";
import SearchBar from "./SearchBar";
import styles from "../../styles/SliceTable.scss";

interface Props {
  tableRef: React.RefObject<{
    goToNextMatch: () => void;
    goToPreviousMatch: () => void;
    currentMatchIndex: number;
    totalMatches: number;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    subscribeToSearch: (listener: () => void) => () => void;
  }>;
  isLoading: boolean;
  hadError: boolean;
  onClickFilterButton: () => void;
  onClickDownload: () => void;
  renderCustomControls: (info: {
    isLoading: boolean;
    hadError: boolean;
    onClickAddColumn: () => void;
  }) => React.ReactNode;
  numFiltersApplied: number;
  // This is threaded through just in case a consumer
  // wants to be able to call it from a custom action.
  onClickAddColumn: () => void;
  controlsClassName?: string;
}

function Controls({
  tableRef,
  isLoading,
  hadError,
  onClickFilterButton,
  onClickDownload,
  renderCustomControls,
  numFiltersApplied,
  onClickAddColumn,
  controlsClassName = undefined,
}: Props) {
  return (
    <div className={cx(styles.Controls, controlsClassName)}>
      <div className={styles.customControls}>
        {renderCustomControls({
          onClickAddColumn,
          isLoading,
          hadError,
        })}
      </div>
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
