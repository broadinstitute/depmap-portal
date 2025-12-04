import React from "react";
import { Tooltip } from "@depmap/common-components";
import styles from "../styles/ReactTable.scss";

type CellTooltipWrapperProps = {
  cell: any;
  shouldShow: boolean;
  children: React.ReactNode;
};

function formatTooltipContent(value: unknown): React.ReactNode {
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
          <li key={i}>{item}</li>
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
}: CellTooltipWrapperProps) {
  if (!shouldShow) {
    return <>{children}</>;
  }

  const content = formatTooltipContent(cell.getValue());

  return (
    <Tooltip id="truncated-cell" content={content} placement="top">
      {children}
    </Tooltip>
  );
}
