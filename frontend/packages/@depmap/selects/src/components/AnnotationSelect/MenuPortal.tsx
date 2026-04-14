/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "../../styles/AnnotationSelect.scss";

interface Props {
  /** The element that triggers the dropdown (used for positioning). */
  controlElement: HTMLElement | null;
  /** Where to portal the menu. Pass document.body to escape modals. */
  appendTo: HTMLElement;
  /** Whether the menu is currently open. */
  isOpen: boolean;
  /** Gap between trigger and menu in pixels. */
  gap?: number;
  /** Minimum width of the menu. */
  minWidth?: number;
  /** Whether to render above or below the trigger. */
  placement?: "top" | "bottom";
  children: React.ReactNode;
}

interface PortalPosition {
  top: number;
  left: number;
  minWidth: number;
}

/**
 * Renders dropdown content into a portal, positioned relative to the
 * control element. Supports both top and bottom placement.
 */
export default function MenuPortal({
  controlElement,
  appendTo,
  isOpen,
  gap = 7,
  minWidth = 0,
  placement = "bottom",
  children,
}: Props) {
  const [position, setPosition] = useState<PortalPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!controlElement) return;

    const rect = controlElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset;

    const top =
      placement === "top"
        ? rect.top + scrollTop
        : rect.bottom + scrollTop + gap;

    setPosition({
      top,
      left: rect.left,
      minWidth: Math.max(rect.width, minWidth),
    });
  }, [controlElement, gap, minWidth, placement]);

  useEffect(() => {
    if (!isOpen || !controlElement) {
      setPosition(null);
      return undefined;
    }

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, controlElement, updatePosition]);

  if (!isOpen || !position) return null;

  // Stop mousedown and focus events from bubbling to the document.
  // This prevents modal focus traps (e.g. React Bootstrap's enforceFocus)
  // from stealing focus away from inputs inside the portal.
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.nativeEvent.stopImmediatePropagation();
  };

  const transform =
    placement === "top" ? `translateY(-100%) translateY(-${gap}px)` : undefined;

  return createPortal(
    <div
      ref={wrapperRef}
      className={styles.menuPortal}
      onMouseDown={stopPropagation}
      onFocus={stopPropagation}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        minWidth: position.minWidth,
        maxWidth: "calc(100vw - 32px)",
        zIndex: 9999,
        transform,
      }}
    >
      {children}
    </div>,
    appendTo
  );
}
