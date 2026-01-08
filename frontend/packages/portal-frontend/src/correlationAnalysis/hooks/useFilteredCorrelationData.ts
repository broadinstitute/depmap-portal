import { useEffect, useState } from "react";
import { SortedCorrelations } from "../models/CorrelationPlot";
import { useCorrelationContext } from "../context/useCorrelationContext";

export function useFilteredCorrelationData(
  correlationAnalysisData: SortedCorrelations[],
  featureType: "gene" | "compound"
) {
  const {
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
  } = useCorrelationContext();
  const [filteredData, setFilteredData] = useState<SortedCorrelations[]>([]);

  useEffect(() => {
    const selectedFront: SortedCorrelations[] = [];

    // --- GENE SPECIFIC ---
    if (featureType === "gene") {
      const noGeneFilters =
        selectedCorrelatedDatasets.length === 0 &&
        Object.keys(allSelectedLabels).length === 0;

      if (noGeneFilters) {
        setFilteredData(correlationAnalysisData);
        return;
      }

      const filtered = correlationAnalysisData.filter((data) => {
        const matchesDS =
          selectedCorrelatedDatasets.length === 0 ||
          selectedCorrelatedDatasets.includes(data.featureDataset);

        const isSelected = allSelectedLabels[data.featureDataset]?.includes(
          data.feature
        );

        if (isSelected && matchesDS) selectedFront.push(data);
        return matchesDS && !isSelected;
      });

      selectedFront.sort((a, b) => a.feature.localeCompare(b.feature));
      setFilteredData([...selectedFront, ...filtered]);
      return;
    }

    // --- COMPOUND SPECIFIC BLOCK ---
    if (featureType === "compound") {
      const noCompoundFilters =
        selectedDoses.length === 0 &&
        selectedCorrelatedDatasets.length === 0 &&
        Object.keys(allSelectedLabels).length === 0;

      if (noCompoundFilters) {
        setFilteredData(correlationAnalysisData);
        return;
      }

      const filtered = correlationAnalysisData.filter((data) => {
        const matchesDose =
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
        if (a.feature === b.feature) {
          return (a.dose || "").localeCompare(b.dose || "");
        }
        return a.feature.localeCompare(b.feature);
      });

      setFilteredData([...selectedFront, ...filtered]);
    }
  }, [
    correlationAnalysisData,
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    featureType,
  ]);

  return filteredData;
}
