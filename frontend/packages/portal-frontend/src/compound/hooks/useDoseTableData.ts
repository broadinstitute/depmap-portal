import { useEffect, useState } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import { breadboxAPI } from "@depmap/api";
import { TableFormattedData } from "../types";

// Helper to fetch metadata
async function fetchMetadata<T>(typeName: string, bbapi: typeof breadboxAPI) {
  const dimensionTypes = await bbapi.getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === typeName);
  if (!dimType?.metadata_dataset_id) {
    throw new Error(`No metadata for ${typeName}`);
  }
  return bbapi.getTabularDatasetData(
    dimType.metadata_dataset_id,
    {}
  ) as Promise<T>;
}

function parseDoseKeyToUM(doseKey: string): number {
  // doseKey is like "0.1 uM", "100 nM", "1 mM"
  const match = doseKey.match(/([\d.eE+-]+)\s*(nM|uM|mM)/);
  if (!match) return NaN;
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "nM") return value / 1000;
  if (unit === "uM") return value;
  if (unit === "mM") return value * 1000;
  return value;
}

function buildTableData(
  viabilityAtDose: any,
  dosefMetadata: any,
  modelMetadata: any,
  aucs: Record<string, number>
): { table: TableFormattedData; orderedDoseColumns: string[] } {
  const tableLookup: Record<string, Record<string, number>> = {};
  const allDoseKeys = new Set<string>();
  const doseKeyToVal = new Map<string, number>();
  Object.entries(viabilityAtDose).forEach(([label, modelValuesRaw]) => {
    const modelValues = modelValuesRaw as Record<string, number | null>;
    Object.entries(modelValues).forEach(([model, log2Viability]) => {
      if (log2Viability !== null) {
        const dose = dosefMetadata.Dose[label];
        const unit = dosefMetadata.DoseUnit[label];
        const doseKey = `${dose} ${unit}`;
        doseKeyToVal.set(doseKey, parseFloat(dose));
        allDoseKeys.add(doseKey);
        if (!tableLookup[model]) {
          tableLookup[model] = {};
        }
        tableLookup[model][doseKey] = log2Viability;
      }
    });
  });
  // Sort dose columns by numeric value using doseValToKey
  const orderedDoseColumns = Array.from(allDoseKeys).sort(
    (a, b) => (doseKeyToVal.get(a) ?? 0) - (doseKeyToVal.get(b) ?? 0)
  );
  const table = Object.entries(tableLookup).map(([modelId, doseMap]) => {
    const row: any = {
      cellLine: modelMetadata.CellLineName[modelId],
      modelId,
      auc: parseFloat(aucs[modelId]?.toFixed(3) ?? "NaN"),
    };
    orderedDoseColumns.forEach((doseKey) => {
      row[doseKey] = doseMap[doseKey];
    });
    return row;
  });
  return { table, orderedDoseColumns };
}

export default function useDoseTableData(
  dataset: DRCDatasetOptions | null,
  compoundId: string,
  compoundName: string
) {
  const [
    tableFormattedData,
    setTableFormattedData,
  ] = useState<TableFormattedData | null>(null);
  const [doseColumnNames, setDoseColumnNames] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!dataset) {
      setTableFormattedData(null);
      setDoseColumnNames([]);
      setError(false);
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const bbapi = breadboxAPI;
        // Fetch all required data
        const dimensions = await bbapi.searchDimensions({
          substring: compoundName,
          type_name: "compound_dose",
          limit: 100,
        });
        const featureLabels = dimensions.map(({ label }) => label);
        const viabilityAtDose = await bbapi.getMatrixDatasetFeaturesData(
          dataset.viability_dataset_id,
          featureLabels,
          "label"
        );

        // TODO: move id of dataset specific metadata to legacy db drc_dataset mapping
        const doseMetadata = await fetchMetadata<{
          Dose: Record<string, number>;
          DoseUnit: Record<string, string>;
        }>("compound_dose", bbapi);
        const modelMetadata = await fetchMetadata<{
          CellLineName: Record<string, string>;
        }>("depmap_model", bbapi);

        const aucsListResponse = await bbapi.getMatrixDatasetFeaturesData(
          dataset.auc_dataset_id,
          [compoundId]
        );
        const aucs = aucsListResponse[compoundId];

        // Build table and columns
        const { table, orderedDoseColumns } = buildTableData(
          viabilityAtDose,
          doseMetadata,
          modelMetadata,
          aucs
        );

        setTableFormattedData(table);
        setDoseColumnNames(orderedDoseColumns);
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setTableFormattedData(null);
        setDoseColumnNames([]);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, [dataset, compoundId, compoundName]);

  return { tableFormattedData, doseColumnNames, error, isLoading };
}
