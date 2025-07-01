import { useEffect, useState } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import { breadboxAPI } from "@depmap/api";
import { TableFormattedData } from "../types";

// Helper to fetch metadata
async function fetchMetadata<T>(
  typeName: string,
  indices: string[] | null,
  columns: string[] | null,
  bbapi: typeof breadboxAPI
) {
  const dimType = await bbapi.getDimensionType(typeName);
  if (!dimType?.metadata_dataset_id) {
    throw new Error(`No metadata for ${typeName}`);
  }

  let args;
  if (indices && indices.length > 0) {
    args = { indices, identifier: "label" as const, columns };
  } else {
    args = { indices: null, identifier: null, columns };
  }
  return bbapi.getTabularDatasetData(
    dimType.metadata_dataset_id,
    args
  ) as Promise<T>;
}

const doseMetadataCache = new Map<string, any>();
const modelMetadataCache = new Map<string, any>();

async function fetchCachedMetadata<T>(
  typeName: string,
  indices: string[] | null,
  columns: string[] | null,
  bbapi: typeof breadboxAPI
) {
  const cacheKey = `${typeName}-${JSON.stringify(indices)}-${JSON.stringify(
    columns
  )}`;
  const cache =
    typeName === "compound_dose" ? doseMetadataCache : modelMetadataCache;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const data = await fetchMetadata<T>(typeName, indices, columns, bbapi);
  cache.set(cacheKey, data);
  return data;
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
  compoundId: string
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

        const datasetFeatures = await bbapi.getDatasetFeatures(
          dataset.viability_dataset_id
        );

        const featureLabels = datasetFeatures.map((df) => df.label);

        const viabilityFeatureLabels = featureLabels.filter((label) =>
          label.startsWith(compoundId)
        );

        const [
          viabilityAtDose,
          doseMetadata,
          modelMetadata,
          aucsListResponse,
        ] = await Promise.all([
          bbapi.getMatrixDatasetFeaturesData(
            dataset.viability_dataset_id,
            viabilityFeatureLabels,
            "label"
          ),
          fetchCachedMetadata<{
            Dose: Record<string, number>;
            DoseUnit: Record<string, string>;
          }>(
            "compound_dose",
            viabilityFeatureLabels,
            ["Dose", "DoseUnit"],
            bbapi
          ),
          fetchCachedMetadata<{
            CellLineName: Record<string, string>;
          }>("depmap_model", null, ["CellLineName"], bbapi),
          bbapi.getMatrixDatasetFeaturesData(dataset.auc_dataset_id, [
            compoundId,
          ]),
        ]);

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
  }, [dataset, compoundId]);

  return { tableFormattedData, doseColumnNames, error, isLoading };
}
