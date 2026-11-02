import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import styles from "../../styles/SettingsModal.scss";

// Gap between the bottom of the trigger swatch and the top of the popover.
const GAP = 5;

interface Props {
  show: boolean;
  // The trigger swatch. The popover is positioned just below it, and
  // mousedowns inside it don't count as "outside" (otherwise clicking the
  // swatch would close and immediately reopen the popover).
  anchor: HTMLElement | null;
  onHide: () => void;
  children: React.ReactNode;
}

// The editor lives in a portal because Modal.Body (.SettingsModal) sets
// overflow-y: auto to scroll the settings list, which clips any descendant
// that tries to overflow it — and the color pickers, which sit near the
// bottom of the list, are exactly that.
function GradientEditorPopover({ show, anchor, onHide, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + GAP, left: rect.left });
  }, [anchor]);

  // Layout effect (not a plain effect) so the popover has its position
  // before the browser paints and never flashes in the wrong spot.
  useLayoutEffect(() => {
    if (show) {
      updatePosition();
    } else {
      setPosition(null);
    }
  }, [show, updatePosition]);

  // Fixed positioning is relative to the viewport, so the popover has to be
  // repositioned when anything moves the swatch. Capture phase: the scroll
  // that matters is .SettingsModal's own, which doesn't bubble.
  useEffect(() => {
    if (!show) {
      return undefined;
    }

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [show, updatePosition]);

  useEffect(() => {
    if (!show) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (
        !ref.current?.contains(target) &&
        !anchor?.contains(target) &&
        target !== anchor
      ) {
        onHide();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, anchor, onHide]);

  if (!show || !position) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      ref={ref}
      // stylesSection is carried along deliberately: the inputs and labels in
      // here are styled by its descendant selectors, and the portal moves
      // them out from under it.
      className={`${styles.stylesSection} ${styles.gradientEditor}`}
      style={position}
    >
      {children}
    </div>,
    document.body
  );
}

export default GradientEditorPopover;
