import { breadboxAPI, cached } from "@depmap/api";
import { Dataset, MatrixDataset } from "@depmap/types";
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

export async function getDependencyDatasetIds(
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
      d.feature_type_name === "gene"
  );

  if (filteredDatasets.length === 0) {
    return [];
  }

  return filteredDatasets.map(({ given_id }: Dataset) => given_id!);
}
