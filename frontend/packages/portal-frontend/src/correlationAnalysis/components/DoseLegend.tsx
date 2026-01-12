import React, { useMemo } from "react";
import { formatDoseString, sortDoseColorsByValue } from "../utilities/helper";
import styles from "../styles/CorrelationAnalysis.scss";

interface DoseLegendProps {
  doseColors: { hex: string | undefined; dose: string }[];
}

export default function DoseLegend(props: DoseLegendProps) {
  const { doseColors } = props;

  const sortedDoseColors = useMemo(() => sortDoseColorsByValue(doseColors), [
    doseColors,
  ]);
  return (
    <div className={styles.doseLegendContainer}>
      <header>Dose</header>
      {sortedDoseColors.map((doseColor, idx) => (
        <div key={idx} style={{ display: "flex" }}>
          <div
            style={{
              backgroundColor: doseColor.hex,
              width: "20px",
              height: "20px",
            }}
          />
          <p style={{ paddingLeft: "5px" }}>
            {formatDoseString(doseColor.dose)}
          </p>
        </div>
      ))}
    </div>
  );
}
