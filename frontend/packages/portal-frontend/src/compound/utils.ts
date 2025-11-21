import { breadboxAPI, cached } from "@depmap/api";
import { getUrlPrefix } from "@depmap/globals";
import { Dataset, MatrixDataset } from "@depmap/types/src/Dataset";

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

export async function getAvailableCorrelationDatasetForEntity(
  compoundID: string
): Promise<Dataset[] | null> {
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

  return sorted;
}

export async function getHighestPriorityCorrelationDatasetForEntity(
  compoundID: string
): Promise<string | null> {
  const sorted = await getAvailableCorrelationDatasetForEntity(compoundID);

  if (sorted == null) return null;

  return sorted[0].given_id || null;
}

export function getFullUrlPrefix() {
  let relativeUrlPrefix = getUrlPrefix();

  if (relativeUrlPrefix === "/") {
    relativeUrlPrefix = "";
  }

  const urlPrefix = `${window.location.protocol}//${window.location.host}${relativeUrlPrefix}`;
  return urlPrefix;
}

export const getCorrelationColor = (val: number) => {
  if (val >= 0) {
    // Ranges:
    // Light red - rgb(255, 200, 200)
    // Dark red -  rgb(150,   0,   0)
    const r = Math.round(255 - 105 * val);
    const g = Math.round(200 - 200 * val);
    const b = Math.round(200 - 200 * val);

    return `rgb(${r}, ${g}, ${b})`;
  }

  // Ranges:
  // Light blue - rgba(203, 223, 246, 1)
  // Dark blue - rgba(0, 117, 250, 1)
  const R_LIGHT = 189;
  const G_LIGHT = 216;
  const B_LIGHT = 246;

  const R_DARK = 0;
  const G_DARK = 117;
  const B_DARK = 250;

  // Calculate the Differences
  // Since val goes from 0 to -1, we need to subtract the change vector
  // to move from LIGHT to DARK.
  const deltaR = R_DARK - R_LIGHT;
  const deltaG = G_DARK - G_LIGHT;
  const deltaB = B_DARK - B_LIGHT;

  const r = Math.round(R_LIGHT + deltaR * -val);
  const g = Math.round(G_LIGHT + deltaG * -val);
  const b = Math.round(B_LIGHT + deltaB * -val);

  // Ensure values are within the valid 0-255 range
  const R = Math.max(0, Math.min(255, r));
  const G = Math.max(0, Math.min(255, g));
  const B = Math.max(0, Math.min(255, b));

  return `rgba(${R}, ${G}, ${B}, 1)`;
};
