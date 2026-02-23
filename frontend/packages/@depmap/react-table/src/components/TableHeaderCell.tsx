/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import React from "react";
import cx from "classnames";
import { flexRender, Header } from "@tanstack/react-table";
import { ColumnMenuButton } from "./ColumnMenuButton";
import styles from "../styles/ReactTable.scss";

type TableHeaderCellProps<T> = {
  header: Header<T, unknown>;
  isSticky: boolean;
  stickyLeft: number | undefined;
  isSortable: boolean;
  isSelectColumn: boolean;
};

export function TableHeaderCell<T>({
  header,
  isSticky,
  stickyLeft,
  isSortable,
  isSelectColumn,
}: TableHeaderCellProps<T>) {
  const canResize = header.column.getCanResize();
  const resizeHandler = header.getResizeHandler();
  const headerMenuItems = (header.column.columnDef.meta as any)
    ?.headerMenuItems;

  return (
    <th
      className={isSticky ? styles.stickyCell : undefined}
      style={{
        width: header.getSize(),
        cursor: isSortable || isSelectColumn ? "pointer" : "default",
        ...(isSticky && stickyLeft !== undefined ? { left: stickyLeft } : {}),
      }}
      onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
    >
      <div className={styles.thContent}>
        <div className={styles.renderedHeaderText}>
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>

        {!isSelectColumn && (
          <div className={styles.headerActions}>
            <div className={styles.columnMenuButtonContainer}>
              {headerMenuItems?.length > 0 ? (
                <ColumnMenuButton items={headerMenuItems} />
              ) : null}
            </div>
            {isSortable && (
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
}
