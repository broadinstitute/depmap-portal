import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { DimensionType } from "@depmap/types";
import type {
  CompoundDoseViability,
  HeatmapFormattedData,
  TableFormattedData,
} from "src/doseViabilityPrototype/types";

const fetchDimensionTypes = async () => {
  // FIXME: use an API wrapper instead of `fetch`
  const response = await fetch("../breadbox/types/dimensions");
  return response.json() as Promise<DimensionType[]>;
};

const fetchMetadata = async <T>(feature_type_name: string) => {
  const dimensionTypes = await fetchDimensionTypes();

  const dimType = dimensionTypes.find((t) => t.name === feature_type_name);
  const url = "../breadbox/datasets/tabular/" + dimType!.metadata_dataset_id;

  // FIXME: use an API wrapper instead of `fetch`
  const response = await fetch(url, { method: "POST" });
  const json = await response.json();

  return json as T;
};

function useData(compoundName: string) {
  const [
    heatmapFormattedData,
    setHeatmapFormattedData,
  ] = useState<HeatmapFormattedData | null>(null);
  const [
    tableFormattedData,
    setTableFormattedData,
  ] = useState<TableFormattedData | null>(null);
  const [doseColumnNames, setDoseColumnNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        const dimensions = await breadboxAPI.searchDimensions({
          substring: compoundName,
          type_name: "oncref_collapsed_metadata",
          limit: 100,
        });

        const featureLabels = dimensions.map(({ label }) => label);

        // FIXME: use an API wrapper instead of `fetch`
        const response = await fetch(
          "../breadbox/datasets/matrix/Prism_oncology_viability",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              feature_identifier: "label",
              features: featureLabels,
            }),
          }
        );

        const viabilityAtDose: CompoundDoseViability = await response.json();

        const oncrefMetadata = await fetchMetadata<{
          Dose: Record<string, number>;
          DoseUnit: Record<string, string>;
        }>("oncref_collapsed_metadata");

        const modelMetadata = await fetchMetadata<{
          CellLineName: Record<string, string>;
        }>("depmap_model");

        const flatData: {
          dose: number;
          model: string;
          viability: number;
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
