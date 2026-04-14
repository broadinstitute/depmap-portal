import { useCallback, useEffect, useState } from "react";

const DEFAULT_MAX_HEIGHT = 360;
const MIN_USABLE_HEIGHT = 210;
const VIEWPORT_PADDING = 16;

interface MenuPlacement {
  placement: "top" | "bottom";
  maxHeight: number;
}

/**
 * Calculates whether a dropdown should appear above or below the trigger,
 * and constrains its max-height to fit within the viewport.
 *
 * - If there's enough space below (>= minUsableHeight), place below and
 *   constrain maxHeight to available space.
 * - If space below is too small, flip to top and constrain to space above.
 * - Recalculates on scroll and resize while open.
 */
export default function useMenuPlacement(
  triggerElement: HTMLElement | null,
  isOpen: boolean,
  gap = 7
): MenuPlacement {
  const [placement, setPlacement] = useState<MenuPlacement>({
    placement: "bottom",
    maxHeight: DEFAULT_MAX_HEIGHT,
  });

  const calculate = useCallback(() => {
    if (!triggerElement) return;

    const rect = triggerElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom - gap - VIEWPORT_PADDING;
    const spaceAbove = rect.top - gap - VIEWPORT_PADDING;

    if (spaceBelow >= MIN_USABLE_HEIGHT) {
      setPlacement({
        placement: "bottom",
        maxHeight: Math.min(DEFAULT_MAX_HEIGHT, spaceBelow),
      });
    } else {
      setPlacement({
        placement: "top",
        maxHeight: Math.min(DEFAULT_MAX_HEIGHT, spaceAbove),
      });
    }
  }, [triggerElement, gap]);

  useEffect(() => {
    if (!isOpen || !triggerElement) return undefined;

    calculate();

    window.addEventListener("scroll", calculate, true);
    window.addEventListener("resize", calculate);

    return () => {
      window.removeEventListener("scroll", calculate, true);
      window.removeEventListener("resize", calculate);
    };
  }, [isOpen, triggerElement, calculate]);

  return placement;
}
