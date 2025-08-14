import { useEffect, useState } from "react";
import { HeatmapFormattedData } from "../types";

function useData() {
  const [
    heatmapFormattedData,
    setHeatmapFormattedData,
  ] = useState<HeatmapFormattedData | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        const flatData: {
          geneSymbol: number;
          termOrTermGroup: string;
          fractionMatching: number;
        }[] = [];
        const tableLookup: Record<string, Record<string, number>> = {};

        Object.entries(viabilityAtDose).forEach(([label, modelValues]) => {
          Object.entries(modelValues).forEach(([model, viability]) => {
            if (viability !== null) {
              const dose = oncrefMetadata.Dose[label];
              const unit = oncrefMetadata.DoseUnit[label];
              flatData.push({ model, dose, viability });

              tableLookup[model] = tableLookup[model] || {};
              tableLookup[model][`${dose} ${unit}`] = viability;
            }
          });
        });

        const meanViabilityByModel: Record<string, number> = {};
        const tableData: TableFormattedData = [];

        Object.entries(tableLookup).forEach(([depmapId, doseMap]) => {
          tableData.push({
            "Cell Line": modelMetadata.CellLineName[depmapId],
            depmapId,
            ...doseMap,
          });

          const values = Object.values(doseMap);
          meanViabilityByModel[depmapId] =
            values.reduce((sum, val) => sum + val, 0) / values.length;
        });

        const uniqueModels = [...new Set(flatData.map((d) => d.model))];
        const uniqueDoses = [...new Set(flatData.map((d) => d.dose))].sort(
          (a, b) => a - b
        );

        const sortedModels = uniqueModels.sort(
          (a, b) => meanViabilityByModel[a] - meanViabilityByModel[b]
        );

        const zMatrix = Array.from({ length: uniqueDoses.length }, () =>
          Array(sortedModels.length).fill(null)
        ) as (number | null)[][];

        const modelIndex = Object.fromEntries(
          sortedModels.map((m, i) => [m, i])
        );
        const doseIndex = Object.fromEntries(uniqueDoses.map((d, i) => [d, i]));

        flatData.forEach(({ dose, model, viability }) => {
          const row = doseIndex[dose];
          const col = modelIndex[model];
          zMatrix[row][col] = viability;
        });

        setTableFormattedData(tableData);

        setDoseColumnNames(
          Object.keys(tableData[0] || {})
            .filter((key) => key !== "Cell Line" && key !== "depmapId")
            .sort((a, b) => parseFloat(a) - parseFloat(b))
        );

        const seen = new Set<string>();

        const cellLineNames = sortedModels.map((id) => {
          let name = modelMetadata.CellLineName[id];

          if (seen.has(name)) {
            window.console.warn(`Warning: duplicate cell line name "${name}"!`);
            name += ` (${id})`;
          }

          seen.add(name);
          return name;
        });

        setHeatmapFormattedData({
          modelIds: sortedModels,
          x: cellLineNames,
          y: uniqueDoses,
          z: zMatrix,
        });

        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, [compoundName]);

  return {
    isLoading,
    heatmapFormattedData,
    doseColumnNames,
    tableFormattedData,
  };
}

export default useData;
