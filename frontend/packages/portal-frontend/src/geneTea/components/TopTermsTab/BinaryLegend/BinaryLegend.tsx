import React from "react";
import styles from "./BinaryLegend.scss";

const BinaryLegend: React.FC = () => {
  return (
    <div className={styles.BinaryLegend}>
      <div key={1} className={styles.legendCategory}>
        <div
          className={styles.colorSquare}
          style={{ backgroundColor: "rgb(0, 110, 87)" }}
        />
        <span>Present</span>
      </div>
      <div key={0} className={styles.legendCategory}>
        <div
          className={styles.colorSquare}
          style={{ backgroundColor: "rgb(232, 232, 232)" }}
        />
        <span>Absent</span>
      </div>
    </div>
  );
};

export default BinaryLegend;
