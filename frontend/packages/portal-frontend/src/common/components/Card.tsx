import React from "react";
import styles from "src/common/styles/card.scss";

export const CardContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardContainer}>{children}</div>;
};

export const CardColumn = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardColumn}>{children}</div>;
};
