import { breadboxAPI, cached } from "@depmap/api";
import { MatrixDataset } from "@depmap/types/src/Dataset";

export const Rep1Color = "#CC4778";
export const Rep2Color = "#F89540";
export const Rep3Color = "#176CE0";

export const compoundImageBaseURL =
  "https://storage.googleapis.com/depmap-compound-images/";

// Added to generate the image url location for the Structure and Detail
// tile. The urls were previously located using Python's urllib.parse.quote,
// which encodes differently. As a result, here we needreplace certain
// characters that Python encodes differently. By default, encodeURIComponent
//  does not encode (, ), !, *, ', while Python’s quote does.
export function pythonQuote(str: string): string {
  // encodeURIComponent, then replace characters Python encodes but JS does not
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

export const hiddenDoseViabilityCols = [
  { accessor: "modelId", Header: "Model ID", maxWidth: 120, minWidth: 80 },
  {
    accessor: "ec50",
    Header: "EC50",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "upperAsymptote",
    Header: "Upper Asymptote",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "lowerAsymptote",
    Header: "Lower Asymptote",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "slope",
    Header: "Slope",
    maxWidth: 120,
    minWidth: 80,
  },
];

export const staticDoseViabilityCols = [
  {
    accessor: "auc",
    Header: "AUC",
    maxWidth: 120,
    minWidth: 80,
  },
  ...hiddenDoseViabilityCols,
];

export function mapEntrezIdToSymbols(
  entrezIds: string[],
  geneMetadata: { label: { [key: number]: string } }
): string[] {
  const symbolLookup = geneMetadata.label;

  const geneSymbols = entrezIds.map((entrezId) => {
    // Look up the symbol, using the Entrez ID as fallback if not found.
    return symbolLookup[Number(entrezId)] || entrezId;
  });

  return geneSymbols;
}

function isMatrixDataset(d: unknown): d is MatrixDataset {
  return (
    typeof d === "object" &&
    d !== null &&
    "units" in d &&
    typeof (d as any).units === "string"
  );
}

export async function getHighestPriorityCorrelationDatasetForEntity(
  compoundID: string
): Promise<string | null> {
  const datasets = await cached(breadboxAPI).getDatasets({
    feature_id: compoundID,
    feature_type: "compound_v2",
  });

  if (datasets.length === 0) {
    return null;
  }

  const matrixDatasets = datasets.filter(
    (d) => isMatrixDataset(d) && d.units === "log2(AUC)"
  );

  const sorted = [...matrixDatasets].sort((a, b) => {
    const pa = typeof a.priority === "number" ? a.priority : Infinity;
    const pb = typeof b.priority === "number" ? b.priority : Infinity;
    return pa - pb;
  });

  if (sorted.length === 0) return null;

  return sorted[0].given_id || null;
}
