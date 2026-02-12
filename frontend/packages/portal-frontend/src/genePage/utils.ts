import { breadboxAPI, cached } from "@depmap/api";
import { Dataset, MatrixDataset } from "@depmap/types";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";
import Papa from "papaparse";
import { fetchMetadata } from "src/compound/fetchDataHelpers";
import { GeneCorrelationDatasetOption } from "src/correlationAnalysis/types";

export async function getCorrelationDatasetsForEntity(
  entrezId: string
): Promise<GeneCorrelationDatasetOption[]> {
  const datasets = await cached(breadboxAPI).getDatasets({
    feature_id: entrezId,
    feature_type: "gene",
  });

  // For now only keep CRISPR and RNAi datasets
  const filteredDatasets = [...datasets].filter(
    (d) =>
      d.given_id !== null &&
      ["Chronos_Combined", "RNAi_merged"].includes(d.given_id)
  );

  if (filteredDatasets.length === 0) {
    return [];
  }

  const sorted = [...filteredDatasets].sort((a, b) => {
    const pa = typeof a.priority === "number" ? a.priority : Infinity;
    const pb = typeof b.priority === "number" ? b.priority : Infinity;
    return pa - pb;
  });

  if (sorted.length === 0) return [];

  const formattedDatasetOptions = sorted.map((dataset: Dataset) => {
    const geneDatasetOption = {
      displayName: dataset.name,
      datasetId: dataset.given_id || dataset.id,
    };

    return geneDatasetOption;
  });

  return formattedDatasetOptions;
}

function isMatrixDataset(d: unknown): d is MatrixDataset {
  return (
    typeof d === "object" &&
    d !== null &&
    "feature_type_name" in d &&
    typeof (d as any).feature_type_name === "string"
  );
}

export async function getTopCodependencyDatasetIds(
  entrezId: string
): Promise<string[]> {
  const datasets = await cached(breadboxAPI).getDatasets({
    feature_id: entrezId,
    feature_type: "gene",
  });

  const filteredDatasets = [...datasets].filter(
    (d) =>
      d.given_id !== null &&
      isMatrixDataset(d) &&
      ["Chronos_Combined", "RNAi_merged"].includes(d.given_id)
  );

  if (filteredDatasets.length === 0) {
    return [];
  }

  return filteredDatasets.map(({ given_id }: Dataset) => given_id!);
}

export async function downloadTopCorrelations(
  geneSymbol: string,
  datasetDisplayName: string,
  correlationsData: AssociatedFeatures[]
) {
  const geneMetadata = await fetchMetadata<any>(
    "gene",
    null,
    ["label"],
    breadboxAPI,
    "id"
  );
  // 1. Create lookup map for the Join
  const geneMap = new Map(
    Object.entries(geneMetadata.label).map(([entrez_id, label]) => [
      label, // Key: the string label (e.g., "SOX10")
      entrez_id, // Value: the ID (e.g., "6662")
    ])
  );

  // 1. Create objects
  const dataToExport = correlationsData.map((corr) => ({
    Gene: corr.other_dimension_label,
    "Entrez Id": geneMap.get(corr.other_dimension_label) ?? "N/A",
    Dataset: datasetDisplayName,
    Correlation: corr.correlation,
  }));

  // 2. Use Papa.unparse to convert objects to a CSV string
  const csvContent = Papa.unparse(dataToExport, {
    quotes: true, // Forces quotes around all cells for safety
    header: true, // Uses the object keys as the first row
  });

  // 4. Native Browser Download Trigger
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `${geneSymbol}'s Top 100 Codependencies for ${datasetDisplayName}.csv`
  );

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL to free up memory
  URL.revokeObjectURL(url);
}
