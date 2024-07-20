import React, { useState, ReactNode } from "react";
import cx from "classnames";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

interface Props {
  title: string;
  className?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  innerRef?: React.LegacyRef<HTMLDivElement>;
}

function Section({
  title,
  children,
  className = undefined,
  defaultOpen = true,
  onOpen = () => {},
  onClose = () => {},
  innerRef = null,
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <div
      className={cx(styles.Section, className)}
      ref={innerRef}
      data-open={open || undefined}
    >
      <label className={styles.sectionTitle}>
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
      {open && <div className={styles.sectionContent}>{children}</div>}
    </div>
  );
}

export default Section;
