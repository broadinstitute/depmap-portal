/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import React from "react";
import cx from "classnames";
import { flexRender, Table } from "@tanstack/react-table";
import styles from "../styles/ReactTable.scss";

type StickyColumnsInfo = {
  selectColumnWidth: number;
  hasSelectColumn: boolean;
  hasStickyFirstColumn: boolean;
};

type TableHeaderProps<T> = {
  table: Table<T>;
  stickyColumnsInfo: StickyColumnsInfo;
};

export function TableHeader<T>({
  table,
  stickyColumnsInfo,
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
              const canResize = header.column.getCanResize();
              const resizeHandler = header.getResizeHandler();

              // Check if this is the select column
              const isSelectColumn = header.column.id === "select";

              // Check if this is the first data column (after selection column if present)
              const isFirstDataColumn =
                hasStickyFirstColumn &&
                ((hasSelectColumn && index === 1) ||
                  (!hasSelectColumn && index === 0));

              // Determine sticky positioning
              let stickyLeft: number | undefined;
              if (isSelectColumn) {
                stickyLeft = 0;
              } else if (isFirstDataColumn) {
                stickyLeft = hasSelectColumn ? selectColumnWidth : 0;
              }

              const isSticky = isSelectColumn || isFirstDataColumn;

              return (
                <th
                  key={header.id}
                  className={isSticky ? styles.stickyCell : undefined}
                  style={{
                    width: header.getSize(),
                    ...(isSticky && stickyLeft !== undefined
                      ? { left: stickyLeft }
                      : {}),
                  }}
                  onClick={
                    !isSelectColumn
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                >
                  <div
                    className={styles.thContent}
                    style={{
                      cursor:
                        !isSelectColumn && header.column.getCanSort()
                          ? "pointer"
                          : "default",
                    }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {!isSelectColumn && (
                      <div className={styles.sortIcon}>
                        <span
                          className={cx("glyphicon glyphicon-triangle-top", {
                            [styles.sortArrowActive]:
                              header.column.getIsSorted() === "asc",
                          })}
                        />
                        <span
                          className={cx("glyphicon glyphicon-triangle-bottom", {
                            [styles.sortArrowActive]:
                              header.column.getIsSorted() === "desc",
                          })}
                        />
                      </div>
                    )}

                    {canResize && (
                      <div
                        className={styles.resizer}
                        onDoubleClick={() => header.column.resetSize()}
                        onMouseDown={resizeHandler}
                        onTouchStart={resizeHandler}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        );
      })}
    </thead>
  );
}
