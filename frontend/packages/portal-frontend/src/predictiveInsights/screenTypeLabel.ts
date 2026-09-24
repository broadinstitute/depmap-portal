import { ScreenTypeData } from "./hooks/usePredictiveInsightsData";

// Actuals dataset names look like "CRISPR (DepMap Internal ...)" / "RNAi
// (Achilles+DRIVE+Marcotte, DEMETER2)" — the first word is the short,
// stable label to show throughout the UI (tile titles, section headers).
export function getScreenTypeLabel(screenType: ScreenTypeData) {
  return screenType.actualsDatasetName.split(" ")[0];
}
