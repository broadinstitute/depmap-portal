import { useMemo } from "react";
import { SortedCorrelations } from "../models/CorrelationPlot";
import { useFilteredCorrelationData } from "./useFilteredCorrelationData";
import { useVolcanoPlotData } from "./useVolcanoPlotData";
import { useCorrelationContext } from "../context/useCorrelationContext";

export function useCorrelationUIState(
  correlationAnalysisData: SortedCorrelations[],
  doseColors: { hex: string | undefined; dose: string }[],
  featureType: "gene" | "compound"
) {
  const { allSelectedLabels } = useCorrelationContext();

  const filteredTableData = useFilteredCorrelationData(
    correlationAnalysisData,
    featureType
  );

  const volcanoData = useVolcanoPlotData(
    correlationAnalysisData,
    doseColors,
    featureType
  );

  const selectedRows = useMemo(() => {
    const ids = filteredTableData
      .filter((d) => allSelectedLabels[d.featureDataset]?.includes(d.feature))
      .map((d) => d.id);
    return new Set(ids);
  }, [filteredTableData, allSelectedLabels]);

  return {
    filteredTableData,
    volcanoData,
    selectedRows,
  };
}
