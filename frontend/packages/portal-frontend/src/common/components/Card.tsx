import React from "react";
import styles from "src/common/styles/card.scss";

export const CardContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardContainer}>{children}</div>;
};

export const CardColumn = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardColumn}>{children}</div>;
};

export const CardRowContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardContainer}>{children}</div>;
};

export const CardRow = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardRow}>{children}</div>;
};

export const CardRowItem = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.CardRowItem}>{children}</div>;
};

