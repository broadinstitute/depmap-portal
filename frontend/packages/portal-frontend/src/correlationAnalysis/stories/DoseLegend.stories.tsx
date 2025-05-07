import * as React from "react";
import DoseLegend from "../components/DoseLegend";

export default {
  title: "Components/CorrelationAnalysis/DoseLegend",
  component: DoseLegend,
};

export function DoseLegendStory() {
  const doseColors = [
    { hex: "#A0DA38", dose: "dose1" },
    { hex: "#4AC16D", dose: "dose2" },
    { hex: "#1EA187", dose: "dose3" },
    { hex: "#277F8E", dose: "dose4" },
    { hex: "#365C8D", dose: "dose5" },
    { hex: "#46327E", dose: "dose6" },
    { hex: "#440154", dose: "dose7" },
    { hex: "#F89540", dose: "dose8" },
    { hex: "#CC4778", dose: "dose9" },
  ];

  return <DoseLegend doseColors={doseColors} />;
}
