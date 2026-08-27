import React, { useEffect, useState } from "react";
import { ProgressBar } from "react-bootstrap";
import styles from "../styles/SliceTable.scss";

// A warm persistent-cache load can finish in a frame or two, where a
// determinate bar appearing and vanishing reads as a glitch.
const REVEAL_DELAY_MS = 400;

interface Props {
  loaded: number;
  total: number;
}

/** Determinate progress for SliceTable's one-request-per-column fetches. */
function LoadingProgress({ loaded, total }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), REVEAL_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  // Nothing to watch with a single column.
  if (!visible || total <= 1) {
    return null;
  }

  const percent = (loaded / total) * 100;
  const text =
    loaded === 0 ? "Loading..." : `Loading ${loaded} of ${total} columns`;

  return (
    <div className={styles.loadingProgress}>
      <ProgressBar active striped now={percent} label={text} srOnly />
    </div>
  );
}

export default LoadingProgress;
