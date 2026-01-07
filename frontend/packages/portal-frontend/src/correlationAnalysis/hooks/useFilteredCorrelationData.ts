import { useEffect, useState } from "react";
import { SortedCorrelations } from "../models/CorrelationPlot";

export function useFilteredCorrelationData(
  correlationAnalysisData: SortedCorrelations[],
  selectedCorrelatedDatasets: string[],
  selectedDoses: string[],
  allSelectedLabels: Record<string, string[]>,
  featureType: "gene" | "compound"
) {
  const [filteredData, setFilteredData] = useState<SortedCorrelations[]>([]);

  useEffect(() => {
    const isGene = featureType === "gene";
    const noFilters =
      (isGene || selectedDoses.length === 0) &&
      selectedCorrelatedDatasets.length === 0 &&
      Object.keys(allSelectedLabels).length === 0;

    if (noFilters) {
      setFilteredData(correlationAnalysisData);
      return;
    }

    const selectedFront: SortedCorrelations[] = [];
    const filtered = correlationAnalysisData.filter((data) => {
      const matchesDose =
        isGene ||
        selectedDoses.length === 0 ||
        (typeof data.dose === "string" && selectedDoses.includes(data.dose));
      const matchesDS =
        selectedCorrelatedDatasets.length === 0 ||
        selectedCorrelatedDatasets.includes(data.featureDataset);

      const keep = matchesDose && matchesDS;
      const isSelected = allSelectedLabels[data.featureDataset]?.includes(
        data.feature
      );

      if (isSelected && keep) selectedFront.push(data);
      return keep && !isSelected;
    });

    selectedFront.sort((a, b) => {
      if (a.feature === b.feature && !isGene) {
        return (a.dose || "").localeCompare(b.dose || "");
      }
      return a.feature.localeCompare(b.feature);
    });

    setFilteredData([...selectedFront, ...filtered]);
  }, [
    correlationAnalysisData,
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    featureType,
  ]);

  return filteredData;
}
