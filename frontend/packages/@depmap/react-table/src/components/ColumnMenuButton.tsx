import React, { useRef, useState } from "react";
import { ColumnMenu } from "./ColumnMenu";
import styles from "../styles/ReactTable.scss";

interface Props {
  items: (
    | {
        label: string;
        icon: string;
        onClick: () => void;
        disabled?: boolean;
      }
    | { widget: "divider" }
  )[];
}

export function ColumnMenuButton({ items }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: Math.max(180, rect.right) + window.scrollX,
      });
    }
    setMenuOpen((prev) => !prev);
  };

  const handleClose = () => setMenuOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.columnMenuButton}
        onClick={handleClick}
        title="Column options"
      >
        <i
          className="glyphicon glyphicon-option-horizontal"
          style={{ fontSize: 9 }}
        />
      </button>

      {menuOpen && (
        <ColumnMenu
          items={items}
          position={menuPosition}
          onClose={handleClose}
        />
      )}
    </>
  );
}
