import { AnalysisConfiguration } from "../types/AnalysisConfiguration";

function getAnalysisKindDisplayName(
  kind: Partial<AnalysisConfiguration>["kind"]
) {
  if (!kind) {
    return "";
  }

  if (kind === "pearson_correlation") {
    return "Pearson correlation";
  }

  if (kind === "two_class_comparison") {
    return "two class comparison";
  }

  return "unknown";
}

export default getAnalysisKindDisplayName;
