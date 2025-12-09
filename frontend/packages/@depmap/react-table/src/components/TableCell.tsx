import React from "react";
import { Cell, flexRender } from "@tanstack/react-table";
import { CellTooltipWrapper } from "./CellTooltipWrapper";
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

export function TableCell<T>({
  cell,
  index,
  stickyColumnsInfo,
  isTruncated,
  onMouseEnterOrMove,
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

  const cellStyle: React.CSSProperties = {
    width: cell.column.getSize(),
    ...(isSticky && stickyLeft !== undefined ? { left: stickyLeft } : {}),
  };

  return (
    <CellTooltipWrapper cell={cell} shouldShow={isTruncated}>
      <td
        className={isSticky ? styles.stickyCell : undefined}
        onMouseEnter={onMouseEnterOrMove}
        onMouseMove={onMouseEnterOrMove}
        style={cellStyle}
      >
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    </CellTooltipWrapper>
  );
}
