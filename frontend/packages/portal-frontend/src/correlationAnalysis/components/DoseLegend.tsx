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

export default function DoseLegend() {
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
      {colors.map((color, idx) => (
        <div key={idx} style={{ display: "flex" }}>
          <div
            style={{
              backgroundColor: color.hex,
              width: "20px",
              height: "20px",
            }}
          />
          <p style={{ paddingLeft: "5px" }}>{color.hex.replace("#", "")}</p>
        </div>
      ))}
    </div>
  );
}
