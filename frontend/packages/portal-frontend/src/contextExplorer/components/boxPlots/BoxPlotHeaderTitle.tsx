import React from "react";
import styles from "./styles.scss";

interface BoxPlotHeaderTitleProps {
  subtypeCode: string;
  selectedCode: string | undefined;
  url: string;
}

export function BoxPlotHeaderTitle({
  subtypeCode,
  selectedCode,
  url,
}: BoxPlotHeaderTitleProps) {
  return selectedCode === subtypeCode ? (
    <span className={styles.unlinkedBoxPlotTitle}>{subtypeCode}</span>
  ) : (
    <a
      className={styles.linkedBoxPlotTitle}
      rel="noreferrer"
      target="_blank"
      href={url}
    >
      {subtypeCode}
    </a>
  );
}
