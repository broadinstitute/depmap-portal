import React from "react";
import { Table } from "@tanstack/react-table";
import { TableHeaderCell } from "./TableHeaderCell";

type StickyColumnsInfo = {
  selectColumnWidth: number;
  hasSelectColumn: boolean;
  hasStickyFirstColumn: boolean;
};

type TableHeaderProps<T> = {
  table: Table<T>;
  stickyColumnsInfo: StickyColumnsInfo;
  scrollColumnIntoView?: (columnId: string) => void;
  cancelScrollColumnIntoView?: () => void;
};

const NOOP = () => {};

export function TableHeader<T>({
  table,
  stickyColumnsInfo,
  scrollColumnIntoView = NOOP,
  cancelScrollColumnIntoView = NOOP,
}: TableHeaderProps<T>) {
  const {
    selectColumnWidth,
    hasSelectColumn,
    hasStickyFirstColumn,
  } = stickyColumnsInfo;

  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => {
        return (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header, index) => {
              const isSelectColumn = header.column.id === "select";

              const isFirstDataColumn =
                hasStickyFirstColumn &&
                ((hasSelectColumn && index === 1) ||
                  (!hasSelectColumn && index === 0));

              let stickyLeft: number | undefined;
              if (isSelectColumn) {
                stickyLeft = 0;
              } else if (isFirstDataColumn) {
                stickyLeft = hasSelectColumn ? selectColumnWidth : 0;
              }

              const isSticky = isSelectColumn || isFirstDataColumn;
              const isSortable = !isSelectColumn && header.column.getCanSort();

              return (
                <TableHeaderCell
                  key={header.id}
                  header={header}
                  isSticky={isSticky}
                  stickyLeft={stickyLeft}
                  isSortable={isSortable}
                  isSelectColumn={isSelectColumn}
                  scrollColumnIntoView={scrollColumnIntoView}
                  cancelScrollColumnIntoView={cancelScrollColumnIntoView}
                />
              );
            })}
          </tr>
        );
      })}
    </thead>
  );
}
