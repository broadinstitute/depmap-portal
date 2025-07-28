import React from "react";
import styles from "../CompoundTiles.scss";

const DoseTriangleLabel: React.FC = () => (
  <div className={styles.triangleWithLabel}>
    <span className={styles.triangleLabel}>Dose</span>
    <svg
      className={styles.triangleSVG}
      viewBox="0 0 18 160"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <polygon
        points="0,0 18,0 9,160"
        fill="none"
        stroke="#000"
        strokeWidth="2"
      />
    </svg>
  </div>
);

export default DoseTriangleLabel;
