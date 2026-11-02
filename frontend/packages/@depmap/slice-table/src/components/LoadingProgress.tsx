import React, { useEffect, useState } from "react";
import cx from "classnames";
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
      {/* `srOnly`, not a visible `label`: ProgressBar renders its label inside
          `.progress-bar`, whose width tracks the percentage, so the text gets
          clipped whenever the bar is narrow. The visible copies are below. */}
      <ProgressBar active striped now={percent} label={text} srOnly />

      {/* Two superimposed copies of the label: a dark one for the grey track,
          and a white one clipped to the filled width for the blue bar. Blend
          modes can't replace this — the bar's mid-tone blue inverts to a tan
          at ~1.5:1 contrast. aria-hidden since `srOnly` above already
          announces the string. */}
      <div aria-hidden="true">
        <span className={styles.progressLabel}>{text}</span>
        <span
          className={cx(styles.progressLabel, styles.progressLabelOnBar)}
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

export default LoadingProgress;
