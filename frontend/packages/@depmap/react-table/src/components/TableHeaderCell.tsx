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
  scrollColumnIntoView?: (columnId: string) => void;
  cancelScrollColumnIntoView?: () => void;
};

const NOOP = () => {};

export function TableHeaderCell<T>({
  header,
  isSticky,
  stickyLeft,
  isSortable,
  isSelectColumn,
  scrollColumnIntoView = NOOP,
  cancelScrollColumnIntoView = NOOP,
}: TableHeaderCellProps<T>) {
  const canResize = header.column.getCanResize();
  const resizeHandler = header.getResizeHandler();
  const headerMenuItems = (header.column.columnDef.meta as any)
    ?.headerMenuItems;

  // Track whether we've already triggered a scroll for this hover session.
  // Reset on mouseleave so the next genuine entry can trigger again.
  const hasTriggeredRef = React.useRef(false);

  const handleMouseMove = () => {
    // mousemove only fires when the user physically moves the pointer,
    // NOT when the element scrolls under a stationary cursor. This
    // prevents the cascading scroll loop caused by overshoot revealing
    // the next column header under the cursor.
    if (isSticky || !scrollColumnIntoView || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    scrollColumnIntoView(header.column.id);
  };

  const handleMouseLeave = () => {
    hasTriggeredRef.current = false;
    if (cancelScrollColumnIntoView) {
      cancelScrollColumnIntoView();
    }
  };

  return (
    <th
      className={isSticky ? styles.stickyCell : undefined}
      style={{
        width: header.getSize(),
        cursor: isSortable || isSelectColumn ? "pointer" : "default",
        ...(isSticky && stickyLeft !== undefined ? { left: stickyLeft } : {}),
      }}
      onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
