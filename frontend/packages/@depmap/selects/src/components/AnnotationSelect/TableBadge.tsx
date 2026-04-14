/* eslint-disable prefer-arrow-callback */
import React from "react";
import styles from "../../styles/AnnotationSelect.scss";

const TableBadge = React.memo(function TableBadge({ name }: { name: string }) {
  return <span className={styles.tableBadge}>{name}</span>;
});

export default TableBadge;
