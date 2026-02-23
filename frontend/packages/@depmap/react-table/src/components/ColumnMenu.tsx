/* eslint-disable
  jsx-a11y/anchor-is-valid,
  jsx-a11y/no-static-element-interactions,
  jsx-a11y/click-events-have-key-events, react/no-array-index-key,
*/
import React, { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import cx from "classnames";
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
  position: {
    top: number;
    left: number;
  };
  onClose: () => void;
}

export function ColumnMenu({ items, position, onClose }: Props) {
  const menuRef = useRef<HTMLUListElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close menu on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <ul
      ref={menuRef}
      className={cx("dropdown-menu", styles.columnMenu)}
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item, i) => {
        if ("widget" in item) {
          if (item.widget !== "divider") {
            console.warn(`Unknown column menu widget "${item.widget}".`);
            return null;
          }

          return <li key={i} className="divider" />;
        }

        return (
          <li key={i}>
            <a
              aria-disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
            >
              <span className={`glyphicon ${item.icon}`} />
              <span style={{ marginLeft: 8 }}>{item.label}</span>
            </a>
          </li>
        );
      })}
    </ul>,
    document.body
  );
}
