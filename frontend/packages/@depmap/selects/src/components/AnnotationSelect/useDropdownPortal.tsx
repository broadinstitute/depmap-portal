import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

interface DropdownPosition {
  top: number;
  left: number;
  minWidth: number;
}

/**
 * Manages portal rendering and positioning for a dropdown.
 *
 * When `portalTarget` is null/undefined, returns passthrough helpers
 * (no portal, normal CSS positioning). When a target is provided,
 * calculates fixed positioning from the trigger's bounding rect.
 */
export default function useDropdownPortal(
  portalTarget: HTMLElement | null | undefined,
  isOpen: boolean,
  gap = 7,
  minWidth = 550
) {
  const triggerRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!portalTarget || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();

    setPosition({
      top: rect.bottom + gap,
      left: rect.left,
      minWidth: Math.max(rect.width, minWidth),
    });
  }, [portalTarget, gap, minWidth]);

  useEffect(() => {
    if (!isOpen || !portalTarget) return undefined;

    updatePosition();

    // Reposition on scroll/resize.
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, portalTarget, updatePosition]);

  /**
   * Wraps dropdown content in a portal if portalTarget is set.
   */
  const renderDropdown = useCallback(
    (content: React.ReactNode): React.ReactNode => {
      if (!portalTarget || !position) return content;

      const portalContent = (
        <div
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            minWidth: position.minWidth,
            maxWidth: `calc(100vw - 32px)`,
            zIndex: 9999,
          }}
        >
          {content}
        </div>
      );

      return ReactDOM.createPortal(portalContent, portalTarget);
    },
    [portalTarget, position]
  );

  return {
    triggerRef,
    renderDropdown,
    usePortal: !!portalTarget,
  };
}
