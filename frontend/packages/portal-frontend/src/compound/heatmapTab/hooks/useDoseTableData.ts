import { useEffect, useState } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import { breadboxAPI } from "@depmap/api";
import { TableFormattedData } from "../../types";

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

// Helper to build table data
function buildTableData(
  viabilityAtDose: any,
  dosefMetadata: any,
  modelMetadata: any,
  aucs: Record<string, number>
): TableFormattedData {
  const tableLookup: Record<string, Record<string, number>> = {};
  Object.entries(viabilityAtDose).forEach(([label, modelValuesRaw]) => {
    const modelValues = modelValuesRaw as Record<string, number | null>;
    Object.entries(modelValues).forEach(([model, log2Viability]) => {
      if (log2Viability !== null) {
        const dose = dosefMetadata.Dose[label];
        const unit = dosefMetadata.DoseUnit[label];
        if (!tableLookup[model]) {
          tableLookup[model] = {};
        }
        tableLookup[model][`${dose} ${unit}`] = log2Viability;
      }
    });
  });
  return Object.entries(tableLookup).map(([modelId, doseMap]) => ({
    cellLine: modelMetadata.CellLineName[modelId],
    modelId,
    auc: parseFloat(aucs[modelId]?.toFixed(3) ?? "NaN"),
    ...doseMap,
  }));
}

// Helper to extract and sort dose columns
function extractDoseColumns(tableData: TableFormattedData): string[] {
  if (!tableData.length) {
    return [];
  }
  return Object.keys(tableData[0])
    .filter((key) => key !== "cellLine" && key !== "modelId" && key !== "auc")
    .sort((a, b) => parseFloat(a) - parseFloat(b));
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

  useEffect(() => {
    if (!dataset) {
      setTableFormattedData(null);
      setDoseColumnNames([]);
      return;
    }
    (async () => {
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
        const tableData = buildTableData(
          viabilityAtDose,
          doseMetadata,
          modelMetadata,
          aucs
        );

        setTableFormattedData(tableData);
        setDoseColumnNames(extractDoseColumns(tableData));
      } catch (e) {
        window.console.error(e);
        setTableFormattedData(null);
        setDoseColumnNames([]);
      }
    })();
  }, [dataset, compoundId, compoundName]);

  return { tableFormattedData, doseColumnNames };
}
