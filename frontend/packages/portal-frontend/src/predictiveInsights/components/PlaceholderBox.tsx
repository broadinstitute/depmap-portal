import React from "react";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  label: string;
  minHeight?: number;
}

export default function PlaceholderBox({ label, minHeight = 300 }: Props) {
  return (
    <div className={styles.placeholderBox} style={{ minHeight }}>
      {label}
    </div>
  );
}
