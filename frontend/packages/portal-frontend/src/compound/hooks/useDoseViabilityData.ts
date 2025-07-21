import { useEffect, useRef, useState } from "react";
import {
  CompoundDoseCurveData,
  CurveParams,
  DRCDatasetOptions,
} from "@depmap/types";
import { breadboxAPI, legacyPortalAPI, cached } from "@depmap/api";
import { TableFormattedData } from "../types";
import { fetchMetadata } from "../fetchDataHelpers";

function buildTableData(
  viabilityAtDose: any,
  dosefMetadata: any,
  modelMetadata: any,
  aucs: Record<string, number>,
  doseCurvesResponse: CompoundDoseCurveData
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
        // Transfrom log2Viability back to viability for display in the Dose Curves and Heatmap table.
        tableLookup[model][doseKey] = 2 ** log2Viability;
      }
    });
  });
  // Sort dose columns by numeric value using doseValToKey
  const orderedDoseColumns = Array.from(allDoseKeys).sort(
    (a, b) => (doseKeyToVal.get(a) ?? 0) - (doseKeyToVal.get(b) ?? 0)
  );
  // Build a lookup for curve_params by id for fast access
  const curveParamsById: Record<string, CurveParams> = {};
  if (doseCurvesResponse && Array.isArray(doseCurvesResponse.curve_params)) {
    for (const params of doseCurvesResponse.curve_params) {
      if (params.id) {
        curveParamsById[params.id] = params;
      }
    }
  }

  const table = Object.entries(tableLookup).map(([modelId, doseMap]) => {
    const row: any = {
      cellLine: modelMetadata.CellLineName[modelId],
      modelId,
      auc: parseFloat(aucs[modelId]?.toFixed(3) ?? "NaN"),
    };
    orderedDoseColumns.forEach((doseKey) => {
      row[doseKey] = doseMap[doseKey];
    });
    // Add curve params if available
    const curveParams = curveParamsById[modelId];
    if (curveParams) {
      row.ec50 = curveParams.ec50;
      row.slope = curveParams.slope;
      row.lowerAsymptote = curveParams.lowerAsymptote;
      row.upperAsymptote = curveParams.upperAsymptote;
    }
    return row;
  });
  return { table, orderedDoseColumns };
}

export async function fetchCompoundDoseCurveData(
  compoundId: string,
  drcDatasetLabel: string,
  replicateDataset: string
): Promise<CompoundDoseCurveData | null> {
  const dapi = legacyPortalAPI;
  const curveData = await cached(dapi).getCompoundDoseCurveData!(
    compoundId,
    drcDatasetLabel,
    replicateDataset
  );

  return curveData;
}

export default function useDoseViabilityData(
  dataset: DRCDatasetOptions | null,
  compoundId: string
) {
  const [
    tableFormattedData,
    setTableFormattedData,
  ] = useState<TableFormattedData | null>(null);
  const [doseColumnNames, setDoseColumnNames] = useState<string[]>([]);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);
  const [doseMin, setDoseMin] = useState<number | null>(null);
  const [doseMax, setDoseMax] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    const thisRequestId = requestIdRef.current;
    if (!dataset) {
      setTableFormattedData(null);
      setDoseColumnNames([]);
      setDoseCurveData(null);
      setError(false);
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const bbapi = breadboxAPI;

        const datasetFeatures = await cached(bbapi).getDatasetFeatures(
          dataset.viability_dataset_given_id
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
          doseCurvesResponse,
        ] = await Promise.all([
          cached(bbapi).getMatrixDatasetData(
            dataset.viability_dataset_given_id,
            {
              features: viabilityFeatureLabels,
              feature_identifier: "label",
            }
          ),
          fetchMetadata<{
            Dose: Record<string, number>;
            DoseUnit: Record<string, string>;
          }>(
            "compound_dose",
            viabilityFeatureLabels,
            ["Dose", "DoseUnit"],
            bbapi
          ),
          // For getting model id --> cell line name
          fetchMetadata<{ CellLineName: Record<string, string> }>(
            "depmap_model",
            null,
            ["CellLineName"],
            bbapi
          ),
          // For getting the AUC column of the dose viability table.
          cached(bbapi).getMatrixDatasetData(dataset.auc_dataset_given_id, {
            features: [compoundId],
            feature_identifier: "id",
          }),
          // For getting dose curves plot data, including replicates. Curve_params are also
          // added to the dose viability table below.
          fetchCompoundDoseCurveData(
            compoundId,
            dataset.drc_dataset_label,
            dataset.replicate_dataset
          ),
        ]);

        // AUC will be an additional column added to the table
        const aucs = aucsListResponse[compoundId];

        // Build table and columns
        const { table, orderedDoseColumns } = buildTableData(
          viabilityAtDose,
          doseMetadata,
          modelMetadata,
          aucs,
          doseCurvesResponse! // For adding the dose curve params as columns to the table
        );

        // For determining the min/max of dose curve axes
        const doseValues = Array.isArray(orderedDoseColumns)
          ? orderedDoseColumns
              .map((d) => parseFloat(d.split(" ")[0]))
              .filter((n) => !Number.isNaN(n))
          : [];

        // Don't set state if the request is stale to avoid a race condition that
        // could cause incorrect data to display in the UI as a result of rapidly
        // changing props (e.g. switching between different datasets).
        if (requestIdRef.current !== thisRequestId) return;
        setDoseMin(doseValues.length > 0 ? Math.min(...doseValues) : null);
        setDoseMax(doseValues.length > 0 ? Math.max(...doseValues) : null);

        setTableFormattedData(table);
        setDoseColumnNames(orderedDoseColumns);
        setDoseCurveData(doseCurvesResponse);
        setIsLoading(false);
      } catch (e) {
        if (requestIdRef.current !== thisRequestId) return;
        window.console.error(e);
        setTableFormattedData(null);
        setDoseColumnNames([]);
        setDoseCurveData(null);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, [dataset, compoundId]);

  return {
    tableFormattedData,
    doseCurveData,
    doseColumnNames,
    doseMin,
    doseMax,
    error,
    isLoading,
  };
}
