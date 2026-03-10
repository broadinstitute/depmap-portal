import React, { useEffect, useState } from "react";
import ButtonWithTooltip from "./ButtonWithTooltip";
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
}

function SearchBar({ tableRef }: Props) {
  // Local state for the input value
  const [searchQuery, setSearchQuery] = useState("");
  // Local state that syncs with tableRef (for match navigation display)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  // Subscribe to search state changes (only for match index and total)
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return () => {};

    // Sync initial state
    setCurrentMatchIndex(table.currentMatchIndex);
    setTotalMatches(table.totalMatches);

    // Subscribe to updates - only sync match navigation state, not the query
    // (the query is managed by the input's onChange)
    const unsubscribe = table.subscribeToSearch(() => {
      setCurrentMatchIndex(table.currentMatchIndex);
      setTotalMatches(table.totalMatches);
    });

    return unsubscribe;
  }, [tableRef]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query); // Update local state immediately for responsive UI
    tableRef.current?.setSearchQuery(query); // Update table
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    tableRef.current?.setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        tableRef.current?.goToPreviousMatch();
      } else {
        tableRef.current?.goToNextMatch();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClearSearch();
    }
  };

  const showControls = searchQuery.length > 0;

  return (
    <div className={styles.searchBar}>
      <i className="glyphicon glyphicon-search" />
      <input
        type="text"
        value={searchQuery}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        placeholder="Find in table"
      />
      {showControls && (
        <>
          <span className={styles.matchCount}>
            {totalMatches > 0
              ? `${currentMatchIndex + 1}/${totalMatches}`
              : "0/0"}
          </span>
          <div className={styles.divider} />
          <ButtonWithTooltip
            className={styles.navButton}
            onClick={() => tableRef.current?.goToPreviousMatch()}
            disabled={totalMatches === 0}
            tooltip="Prev match"
          >
            <i className="glyphicon glyphicon-chevron-up" />
          </ButtonWithTooltip>
          <ButtonWithTooltip
            className={styles.navButton}
            onClick={() => tableRef.current?.goToNextMatch()}
            disabled={totalMatches === 0}
            tooltip="Next match"
          >
            <i className="glyphicon glyphicon-chevron-down" />
          </ButtonWithTooltip>
          <ButtonWithTooltip
            className={styles.clearButton}
            onClick={handleClearSearch}
            tooltip="Clear search"
          >
            ✕
          </ButtonWithTooltip>
        </>
      )}
    </div>
  );
}

export default SearchBar;
