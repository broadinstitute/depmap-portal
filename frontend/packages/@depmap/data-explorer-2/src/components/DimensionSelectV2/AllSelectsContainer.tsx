import React, { useEffect, useRef } from "react";
import cx from "classnames";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  children: React.ReactNode;
  removeWrapperDiv: boolean;
  className?: string | undefined;
  onHeightChange?: (el: HTMLDivElement, prevHeight: number) => void;
  // Lay the controls out as rows of a grid owned by an ancestor, so that two
  // of these side by side line up control-for-control. Opt-in: only the
  // two-axis plot configuration wants it, and it is mutually exclusive with
  // `onHeightChange` (a subgrid container has no independent height to report).
  asGridRows?: boolean;
}

const oldWarnings = new Set<string>();

const warnOnce = (warning: string) => {
  if (!oldWarnings.has(warning)) {
    window.console.warn(warning);
  }

  oldWarnings.add(warning);
};

// Each control gets a cell that exists whether or not the control renders
// anything. That's the whole trick behind the grid alignment: a hidden control
// still occupies its row, so the row's height is set by whichever axis DOES
// show something there, and everything below stays level.
//
// This works because React.Children sees the ELEMENTS passed in, not what they
// render — `<AxisTypeToggle show={false} />` is still a child here even though
// it renders null. A Fragment counts as one child, which is how two mutually
// exclusive controls ask to share a row.
const toGridRows = (children: React.ReactNode) =>
  React.Children.map(children, (child) => (
    <div className={styles.gridRow}>{child}</div>
  ));

function AllSelectsContainer({
  children,
  removeWrapperDiv,
  className = undefined,
  onHeightChange = undefined,
  asGridRows = false,
}: Props) {
  const div = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);

  useEffect(() => {
    if (asGridRows && onHeightChange) {
      warnOnce(
        "`asGridRows` is set. `onHeightChange` will be ignored (a subgrid " +
          "container has no height of its own to measure)\n"
      );
    }

    if (div.current && !asGridRows) {
      const height = div.current.offsetHeight || 0;

      if (
        height > 0 &&
        prevHeight.current > 0 &&
        height !== prevHeight.current
      ) {
        onHeightChange?.(div.current, prevHeight.current);
      }

      prevHeight.current = height;
    }
  });

  if (removeWrapperDiv) {
    if (className) {
      warnOnce("`removeWrapperDiv` is set. `className` will be ignored\n");
    }
    if (onHeightChange) {
      warnOnce("`removeWrapperDiv` is set. `onHeightChange` will be ignored\n");
    }

    return children;
  }

  return (
    <div
      ref={div}
      data-dimension-select
      className={cx(styles.DimensionSelect, className, {
        [styles.gridRows]: asGridRows,
      })}
    >
      {asGridRows ? toGridRows(children) : children}
    </div>
  );
}

export default AllSelectsContainer;
