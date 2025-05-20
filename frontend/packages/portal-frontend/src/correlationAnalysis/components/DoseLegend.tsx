import * as React from "react";

const colors = [
  { hex: "#A0DA38" },
  { hex: "#4AC16D" },
  { hex: "#1EA187" },
  { hex: "#277F8E" },
  { hex: "#365C8D" },
  { hex: "#46327E" },
  { hex: "#440154" },
  { hex: "#F89540" },
  { hex: "#CC4778" },
];

interface DoseLegendProps {
  doseColors: { hex: string; dose: string }[];
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
