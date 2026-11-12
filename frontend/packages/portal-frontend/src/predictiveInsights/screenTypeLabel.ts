import { ScreenTypeData } from "./hooks/usePredictiveInsightsData";

// Actuals dataset names look like "CRISPR (DepMap Internal ...)" / "RNAi
// (Achilles+DRIVE+Marcotte, DEMETER2)" — the first word is the short,
// stable label to show throughout the UI (tile titles, section headers).
// Although the PRISM datasets (ie: "PRISM OncRef (AUC) Lum Internal 26Q3v2" etc) break this rule, so
// if it starts with "PRISM" use the first two words as the label.
export function getScreenTypeLabel(screenType: ScreenTypeData) {
  const words = screenType.actualsDatasetName.split(" ");
  const wordCount = words[0] === "PRISM" ? 2 : 1;
  return words.slice(0, wordCount).join(" ");
}
