import React from "react";
import { Cell, flexRender } from "@tanstack/react-table";
import { CellTooltipWrapper } from "./CellTooltipWrapper";
import { HighlightedText } from "./HighlightedText";
import { MagnitudeBar } from "./MagnitudeBar";
import { ColumnStats } from "./useTableInstance";
import styles from "../styles/ReactTable.scss";

type StickyColumnsInfo = {
  selectColumnWidth: number;
  firstColumnWidth: number;
  hasSelectColumn: boolean;
  hasStickyFirstColumn: boolean;
};

type TableCellProps<T> = {
  cell: Cell<T, unknown>;
  index: number;
  stickyColumnsInfo: StickyColumnsInfo;
  isTruncated: boolean;
  onMouseEnterOrMove: (e: React.MouseEvent<HTMLTableDataCellElement>) => void;
  getCellHighlightStatus?: (
    rowId: string,
    columnId: string
  ) => {
    isMatch: boolean;
    isCurrentMatch: boolean;
  };
  searchQuery?: string;
  columnStats?: Record<string, ColumnStats>;
};

type StickyPositionResult = {
  isSticky: boolean;
  stickyLeft?: number;
};

function calculateStickyPosition(
  isSelectColumn: boolean,
  isFirstDataCol: boolean,
  selectColumnWidth: number,
  hasSelectColumn: boolean
): StickyPositionResult {
  if (isSelectColumn) {
    return { isSticky: true, stickyLeft: 0 };
  }

  if (isFirstDataCol) {
    return {
      isSticky: true,
      stickyLeft: hasSelectColumn ? selectColumnWidth : 0,
    };
  }

  return { isSticky: false };
}

/**
 * Calculate bar style for center-diverging layout.
 * Zero is ALWAYS at 50% (center of cell).
 * Returns the CSS properties for positioning and sizing the bar,
 * plus whether it's a negative value.
 */
function calculateDivergingBarStyle(
  value: number,
  min: number,
  max: number
): { barStyle: React.CSSProperties; isNegative: boolean } {
  const NEGATIVE_COLOR = "#E53935";
  const POSITIVE_COLOR = "#1E88E5";

  if (value < 0 && min < 0) {
    // Negative: percentage of left half (0-50%)
    const barWidthPercent = (Math.abs(value) / Math.abs(min)) * 50;
    return {
      barStyle: {
        left: `${50 - barWidthPercent}%`,
        width: `${barWidthPercent}%`,
        backgroundColor: NEGATIVE_COLOR,
      },
      isNegative: true,
    };
  }

  if (value > 0 && max > 0) {
    // Positive: percentage of right half (0-50%)
    const barWidthPercent = (value / max) * 50;
    return {
      barStyle: {
        left: "50%",
        width: `${barWidthPercent}%`,
        backgroundColor: POSITIVE_COLOR,
      },
      isNegative: false,
    };
  }

  // Zero value - no bar
  return {
    barStyle: { width: 0 },
    isNegative: false,
  };
}

function isFirstDataColumn(
  index: number,
  hasStickyFirstColumn: boolean,
  hasSelectColumn: boolean
): boolean {
  if (!hasStickyFirstColumn) {
    return false;
  }

  return (hasSelectColumn && index === 1) || (!hasSelectColumn && index === 0);
}

/**
 * Recursively walks a React element tree and wraps any string children
 * with HighlightedText to enable substring highlighting while preserving
 * the original structure (links, spans, etc.)
 */
function highlightElement(
  element: React.ReactNode,
  searchQuery: string,
  isCurrentMatch: boolean,
  key?: string | number
): React.ReactNode {
  // Handle strings - wrap with HighlightedText
  if (typeof element === "string") {
    return (
      <HighlightedText
        key={key}
        text={element}
        searchQuery={searchQuery}
        isCurrentMatch={isCurrentMatch}
      />
    );
  }

  // Handle numbers - convert to string and highlight
  if (typeof element === "number") {
    return (
      <HighlightedText
        key={key}
        text={String(element)}
        searchQuery={searchQuery}
        isCurrentMatch={isCurrentMatch}
      />
    );
  }

  // Handle arrays - map over children
  if (Array.isArray(element)) {
    return element.map((child, i) =>
      highlightElement(child, searchQuery, isCurrentMatch, i)
    );
  }

  // Handle React elements
  if (React.isValidElement(element)) {
    const elementType = element.type;

    // DOM element (type is a string like "a", "div", "span")
    if (typeof elementType === "string") {
      const { children } = element.props as { children?: React.ReactNode };

      if (children === undefined || children === null) {
        return element;
      }

      return React.cloneElement(
        element,
        { ...element.props, key: key ?? element.key },
        React.Children.map(children, (child, i) =>
          highlightElement(child, searchQuery, isCurrentMatch, i)
        )
      );
    }

    // Function component - try to invoke it to get its rendered output
    if (typeof elementType === "function") {
      try {
        // Check if it's a class component (has prototype.isReactComponent)
        const isClassComponent =
          elementType.prototype && elementType.prototype.isReactComponent;

        if (!isClassComponent) {
          // It's a function component - invoke it with props
          // eslint-disable-next-line @typescript-eslint/ban-types
          const rendered = (elementType as Function)(element.props);
          return highlightElement(rendered, searchQuery, isCurrentMatch, key);
        }
      } catch {
        // If invoking fails, fall through and return element unchanged
      }
    }

    // Class component or failed invocation - return as-is
    return element;
  }

  // Handle null, undefined, booleans - return as-is
  return element;
}

export function TableCell<T>({
  cell,
  index,
  stickyColumnsInfo,
  isTruncated,
  onMouseEnterOrMove,
  getCellHighlightStatus = () => ({
    isMatch: false,
    isCurrentMatch: false,
  }),
  searchQuery = "",
  columnStats = {},
}: TableCellProps<T>) {
  const {
    selectColumnWidth,
    hasSelectColumn,
    hasStickyFirstColumn,
  } = stickyColumnsInfo;

  const isSelectColumn = cell.column.id === "select";
  const isFirstDataCol = isFirstDataColumn(
    index,
    hasStickyFirstColumn,
    hasSelectColumn
  );

  const { isSticky, stickyLeft } = calculateStickyPosition(
    isSelectColumn,
    isFirstDataCol,
    selectColumnWidth,
    hasSelectColumn
  );

  const highlightStatus = getCellHighlightStatus(cell.row.id, cell.column.id);

  const shouldHighlight = highlightStatus.isMatch && searchQuery;

  const cellClassName = [
    isSticky ? styles.stickyCell : undefined,
    highlightStatus.isMatch ? styles.searchMatch : undefined,
    highlightStatus.isCurrentMatch ? styles.currentSearchMatch : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const cellStyle: React.CSSProperties = {
    width: cell.column.getSize(),
    ...(isSticky && stickyLeft !== undefined ? { left: stickyLeft } : {}),
  };

  const renderCellContent = () => {
    const columnDef = cell.column.columnDef;
    const cellContext = cell.getContext();
    const rawValue = cell.getValue();

    // Check if this is a numeric value that should show a magnitude bar
    const colStats = columnStats[cell.column.id];
    const shouldShowMagnitudeBar =
      typeof rawValue === "number" &&
      !Number.isNaN(rawValue) &&
      colStats &&
      colStats.hasVariance;

    // If it's a number with variance, render with MagnitudeBar
    if (shouldShowMagnitudeBar) {
      const { barStyle, isNegative } = calculateDivergingBarStyle(
        rawValue,
        colStats.min,
        colStats.max
      );

      // If we should highlight, we need to highlight the number inside MagnitudeBar
      if (shouldHighlight) {
        return (
          <div className={styles.magnitudeBarCell}>
            {(isNegative || rawValue > 0) && (
              <div className={styles.magnitudeBar} style={barStyle} />
            )}
            <span className={styles.magnitudeBarValue}>
              <HighlightedText
                text={String(rawValue)}
                searchQuery={searchQuery}
                isCurrentMatch={highlightStatus.isCurrentMatch}
              />
            </span>
          </div>
        );
      }

      return (
        <MagnitudeBar value={rawValue} min={colStats.min} max={colStats.max} />
      );
    }

    // Get the rendered content - either from custom cell renderer or default
    let renderedContent: React.ReactNode;

    if (typeof columnDef.cell === "function") {
      // Invoke the cell renderer function directly to get the actual elements
      renderedContent = columnDef.cell(cellContext);
    } else {
      renderedContent = flexRender(columnDef.cell, cellContext);
    }

    // If we should highlight, recursively walk the rendered content
    // and wrap text nodes with HighlightedText
    if (shouldHighlight) {
      return highlightElement(
        renderedContent,
        searchQuery,
        highlightStatus.isCurrentMatch
      );
    }

    return renderedContent;
  };

  return (
    <CellTooltipWrapper
      cell={cell}
      shouldShow={isTruncated}
      searchQuery={searchQuery}
      isCurrentMatch={highlightStatus.isCurrentMatch}
    >
      <td
        className={cellClassName || undefined}
        onMouseEnter={onMouseEnterOrMove}
        onMouseMove={onMouseEnterOrMove}
        style={cellStyle}
      >
        {renderCellContent()}
      </td>
    </CellTooltipWrapper>
  );
}
