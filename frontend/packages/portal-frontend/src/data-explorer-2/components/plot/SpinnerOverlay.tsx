import React, { useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@depmap/common-components";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

function SpinnerOverlay() {
  const container = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties | undefined>(
    undefined
  );

  useLayoutEffect(() => {
    if (container.current) {
      const el = container.current.parentElement as HTMLDivElement;
      const width = el.clientWidth;
      const height = el.clientHeight;
      setStyle({ width, height });
    }
  }, []);

  return (
    <>
      <div className={styles.SpinnerOverlay} style={style} ref={container}>
        <div className={styles.overlayBackground} />
      </div>
      <div className={styles.SpinnerOverlay} style={style}>
        <div>
          <Spinner position="relative" left="-2px" />
        </div>
      </div>
    </>
  );
}

export default SpinnerOverlay;
