import * as React from "react";

interface DoseLegendProps {
  doseColors: { hex: string | undefined; dose: string }[];
}

export default function DoseLegend(props: DoseLegendProps) {
  const { doseColors } = props;
  return (
    <div
      style={{
        border: "1px solid #d9d9d9",
        padding: "10px",
        maxWidth: "max-content",
        maxHeight: "max-content",
      }}
    >
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
