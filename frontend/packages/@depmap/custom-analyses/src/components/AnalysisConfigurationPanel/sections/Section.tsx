import React from "react";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children = undefined }: Props) {
  return (
    <div className={styles.AnalysisConfigSection}>
      <label className={styles.title}>{title}</label>
      <div>{children}</div>
    </div>
  );
}

export default Section;
