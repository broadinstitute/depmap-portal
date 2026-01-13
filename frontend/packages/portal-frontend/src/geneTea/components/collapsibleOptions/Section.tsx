import React, { useState, ReactNode } from "react";
import cx from "classnames";
import styles from "./styles.scss";
import plotStyles from "./plotSectionStyles.scss";

interface Props {
  title: string;
  className?: string;
  children: ReactNode;
  usePlotStyles: boolean;
  defaultOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  innerRef?: React.LegacyRef<HTMLDivElement>;
}

function Section({
  title,
  children,
  usePlotStyles = false,
  className = undefined,
  defaultOpen = true,
  onOpen = () => {},
  onClose = () => {},
  innerRef = null,
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  const currentStyles = usePlotStyles ? plotStyles : styles;

  return (
    <div
      className={cx(currentStyles.Section, className)}
      ref={innerRef}
      data-open={open || undefined}
    >
      <label className={currentStyles.sectionTitle}>
        <span>{title}</span>
        <button
          type="button"
          onClick={() => {
            const nextOpen = !open;
            setOpen(nextOpen);

            if (nextOpen) {
              onOpen();
            } else {
              onClose();
            }
          }}
        >
          {open ? "—" : "+"}
        </button>
      </label>
      {open && <div className={currentStyles.sectionContent}>{children}</div>}
    </div>
  );
}

export default Section;
