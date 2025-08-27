import React from "react";

interface CorrelationBarProps {
  correlation: number;
  height?: number; // default is 20
  width?: string; // default is "100%"
}

export const CorrelationBar = ({
  correlation,
  height = 20,
  width = "100%",
}: CorrelationBarProps) => {
  const getCorrelationColor = (val: number) => {
    // Clamp between 0 and 1. Correlation values are expected to be between 0 to 1.
    const value = Math.max(0, Math.min(1, val));

    if (value < 0.2) {
      // Gray scale: 0 -> light gray, 0.2 -> darker gray
      // Map [0, 0.2] -> [240, 160]
      const gray = Math.round(240 - (value / 0.2) * (240 - 160));
      return `rgb(${gray}, ${gray}, ${gray})`;
    }

    // Original red scale: 0.2 to 1.0
    const scaledVal = (value - 0.2) / 0.8; // normalize to [0, 1]
    const r = Math.round(255 - 105 * scaledVal);
    const g = Math.round(200 - 200 * scaledVal);
    const b = Math.round(200 - 200 * scaledVal);

    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: getCorrelationColor(correlation),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${height * 0.75}px`,
        color: correlation >= 0.4 ? "white" : "black", // contrast text color based on correlation
      }}
    >
      {correlation}
    </div>
  );
};
