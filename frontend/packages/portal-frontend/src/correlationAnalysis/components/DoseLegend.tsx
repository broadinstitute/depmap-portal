import * as React from "react";
import styles from "../styles/CorrelationAnalysis.scss";

interface DoseLegendProps {
  doseColors: { hex: string | undefined; dose: string }[];
}

export default function DoseLegend(props: DoseLegendProps) {
  const { doseColors } = props;
  return (
    <div className={styles.doseLegendContainer}>
      <header>Dose</header>
      {doseColors.map((doseColor, idx) => (
        <div key={idx} style={{ display: "flex" }}>
          <div
            style={{
              backgroundColor: doseColor.hex,
              width: "20px",
              height: "20px",
            }}
          />
          <p style={{ paddingLeft: "5px" }}>{doseColor.dose}</p>
        </div>
      ))}
    </div>
  );
}
