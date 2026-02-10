import React from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import { HighlightedText } from "./HighlightedText";
import styles from "../styles/ReactTable.scss";

type CellTooltipWrapperProps = {
  cell: any;
  shouldShow: boolean;
  children: React.ReactNode;
  searchQuery?: string;
  isCurrentMatch?: boolean;
};

function formatTooltipContent(
  value: unknown,
  searchQuery: string,
  isCurrentMatch: boolean
): React.ReactNode {
  if (Array.isArray(value)) {
    const MAX_ITEMS = 25;
    const totalItems = value.length;
    const shouldTruncate = totalItems - 1 > MAX_ITEMS;
    const itemsToShow = shouldTruncate ? value.slice(0, MAX_ITEMS) : value;
    const remainingCount = totalItems - MAX_ITEMS;

    return (
      <ul className={styles.cellAsListTooltip}>
        {itemsToShow.map((item, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={i}>
            {searchQuery ? (
              <HighlightedText
                text={String(item)}
                searchQuery={searchQuery}
                isCurrentMatch={isCurrentMatch}
              />
            ) : (
              item
            )}
          </li>
        ))}
        {shouldTruncate && (
          <li key="truncated">...and {remainingCount} more</li>
        )}
      </ul>
    );
  }

  return value as React.ReactNode;
}

export function CellTooltipWrapper({
  cell,
  shouldShow,
  children,
  searchQuery = "",
  isCurrentMatch = false,
}: CellTooltipWrapperProps) {
  if (!shouldShow) {
    return <>{children}</>;
  }

  const value = cell.getValue();

  if (value == null) {
    return <>{children}</>;
  }

  let content = formatTooltipContent(value, searchQuery, isCurrentMatch);

  if (typeof content === "string") {
    if (searchQuery) {
      content = (
        <HighlightedText
          text={content}
          searchQuery={searchQuery}
          isCurrentMatch={isCurrentMatch}
        />
      );
    } else {
      content = <WordBreaker text={content} />;
    }
  }

  return (
    <Tooltip id="truncated-cell" content={content} placement="top">
      {children}
    </Tooltip>
  );
}
