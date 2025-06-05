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

const fetchMetadata = async (feature_type_name: string) => {
  const dimensionTypes = await fetchDimensionTypes();

  const dimType = dimensionTypes.find((t) => t.name === feature_type_name);
  const url = "../breadbox/datasets/tabular/" + dimType!.metadata_dataset_id;

  // FIXME: use an API wrapper instead of `fetch`
  const response = await fetch(url, { method: "POST" });
  return response.json();
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

        const data: CompoundDoseViability = await response.json();
        const metadata = await fetchMetadata("oncref_collapsed_metadata");

        const tableData: TableFormattedData = [];

        Object.entries(data).forEach(([label, modelValues]) => {
          Object.entries(modelValues).forEach(([model, viability]) => {
            if (viability !== null) {
              const dose = metadata.Dose[label];
              tableData.push({ model, dose, viability });
            }
          });
        });

        const x = [...new Set(tableData.map((d) => d.model))].sort();
        const y = [...new Set(tableData.map((d) => d.dose))]
          .sort((a, b) => a - b)
          .map(String);
        const z = Array.from({ length: x.length }, () =>
          Array(y.length).fill(null)
        );

        const modelIndex = Object.fromEntries(x.map((m, i) => [m, i]));
        const doseIndex = Object.fromEntries(y.map((d, i) => [d, i]));

        for (let i = 0; i < tableData.length; i++) {
          const dose = tableData[i].dose;
          const model = tableData[i].model;
          const viability = tableData[i].viability;
          const row = doseIndex[dose];
          const col = modelIndex[model];
          z[row][col] = viability;
        }

        setTableFormattedData(tableData);
        setHeatmapFormattedData({ x, y, z });
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, [compoundName]);

  return { isLoading, heatmapFormattedData, tableFormattedData };
}

export default useData;
