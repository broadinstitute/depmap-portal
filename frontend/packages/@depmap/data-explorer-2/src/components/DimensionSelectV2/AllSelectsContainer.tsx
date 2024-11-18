import React, { useEffect, useRef } from "react";
import cx from "classnames";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  children: React.ReactNode;
  removeWrapperDiv: boolean;
  className?: string | undefined;
  onHeightChange?: (el: HTMLDivElement, prevHeight: number) => void;
}

const oldWarnings = new Set<string>();

const warnOnce = (warning: string) => {
  if (!oldWarnings.has(warning)) {
    window.console.warn(warning);
  }

  oldWarnings.add(warning);
};

function AllSelectsContainer({
  children,
  removeWrapperDiv,
  className = undefined,
  onHeightChange = undefined,
}: Props) {
  const div = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);

  useEffect(() => {
    if (div.current) {
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
    <div ref={div} className={cx(styles.DimensionSelect, className)}>
      {children}
    </div>
  );
}

export default AllSelectsContainer;
