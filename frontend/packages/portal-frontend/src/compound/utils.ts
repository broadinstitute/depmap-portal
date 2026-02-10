import { breadboxAPI, cached } from "@depmap/api";
import { getUrlPrefix, toStaticUrl } from "@depmap/globals";
import { ContextExplorerDatasets, CurvePlotPoints } from "@depmap/types";
import { Dataset, MatrixDataset } from "@depmap/types/src/Dataset";

// Constants
export const Rep1Color = "#CC4778";
export const Rep2Color = "#F89540";
export const Rep3Color = "#176CE0";

export const compoundImageBaseURL =
  "https://storage.googleapis.com/depmap-compound-images/";

const DEFAULT_COL_STYLE = { maxWidth: 120, minWidth: 80 };

// --- Internal Helpers ---

function isMatrixDataset(d: unknown): d is MatrixDataset {
  return (
    typeof d === "object" &&
    d !== null &&
    "units" in d &&
    typeof (d as any).units === "string"
  );
}

/**
 * Shared internal fetcher to reduce repetitive Breadbox boilerplate.
 * Handles filtering and sorting by priority (lower number = higher priority).
 */
async function fetchCompoundDatasets(
  compoundId: string,
  featureType: "compound" | "compound_v2" = "compound_v2"
): Promise<MatrixDataset[]> {
  const datasets = await cached(breadboxAPI).getDatasets({
    feature_id: compoundId,
    feature_type: featureType,
  });

  return (datasets as Dataset[])
    .filter(
      (d): d is MatrixDataset =>
        d.given_id !== null &&
        isMatrixDataset(d) &&
        d.feature_type_name === featureType
    )
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}

// --- Data Fetching Utilities ---

export async function getCachedAvailableCompoundDatasetIds(
  compoundId: string
): Promise<string[]> {
  const datasets = await fetchCompoundDatasets(compoundId);
  return datasets.map((d) => d.given_id!);
}

export async function getHighestPriorityCompoundDataset(
  compoundId: string
): Promise<MatrixDataset | null> {
  const datasets = await fetchCompoundDatasets(compoundId);
  return datasets[0] || null;
}

export async function getHighestPriorityCorrelationDatasetForEntity(
  compoundID: string
): Promise<string | null> {
  const datasets = await fetchCompoundDatasets(compoundID);
  const log2Datasets = datasets.filter((d) => d.units === "log2(AUC)");
  return log2Datasets[0]?.given_id || null;
}

export async function doContextExpDatasetsExistWithCompound(
  compoundId: string
): Promise<boolean> {
  const datasets = await fetchCompoundDatasets(compoundId, "compound");
  const validIds: string[] = Object.values(ContextExplorerDatasets);
  return datasets.some((d) => validIds.includes(d.given_id!));
}

// --- Formatting & UI Utilities ---

/**
 * Encodes strings to match Python's urllib.parse.quote behavior.
 * encodeURIComponent ignores ( ) ! * ', while Python's quote does not.
 */
export function pythonQuote(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

export const hiddenDoseViabilityCols = [
  { accessor: "modelId", Header: "Model ID", ...DEFAULT_COL_STYLE },
  { accessor: "ec50", Header: "EC50", ...DEFAULT_COL_STYLE },
  {
    accessor: "upperAsymptote",
    Header: "Upper Asymptote",
    ...DEFAULT_COL_STYLE,
  },
  {
    accessor: "lowerAsymptote",
    Header: "Lower Asymptote",
    ...DEFAULT_COL_STYLE,
  },
  { accessor: "slope", Header: "Slope", ...DEFAULT_COL_STYLE },
];

export const staticDoseViabilityCols = [
  { accessor: "auc", Header: "AUC", ...DEFAULT_COL_STYLE },
  ...hiddenDoseViabilityCols,
];

export function mapEntrezIdToSymbols(
  entrezIds: string[],
  geneMetadata: { label: { [key: number]: string } }
): string[] {
  const symbolLookup = geneMetadata.label;
  return entrezIds.map((id) => symbolLookup[Number(id)] || id);
}

export function getFullUrlPrefix(): string {
  const relativePrefix = getUrlPrefix() === "/" ? "" : getUrlPrefix();
  return `${window.location.protocol}//${window.location.host}${relativePrefix}`;
}

/**
 * Generates a color based on correlation value (-1 to 1).
 * Positive: Light red to Dark red. Negative: Light blue to Dark blue.
 */
export const getCorrelationColor = (val: number): string => {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

  if (val >= 0) {
    return `rgb(${clamp(255 - 105 * val)}, ${clamp(200 - 200 * val)}, ${clamp(
      200 - 200 * val
    )})`;
  }

  // Linear interpolation between Light Blue and Dark Blue
  const factor = -val;
  const r = 189 + (0 - 189) * factor;
  const g = 216 + (117 - 216) * factor;
  const b = 246 + (250 - 246) * factor;

  return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, 1)`;
};

export function groupBy(
  array: Array<CurvePlotPoints>,
  prop: keyof CurvePlotPoints
): Map<string, Array<CurvePlotPoints>> {
  const grouped = new Map<string, Array<CurvePlotPoints>>();

  array.forEach((points) => {
    const val = points[prop];
    if (val !== undefined && val !== null) {
      const key = val.toString();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(points);
    }
  });

  return grouped;
}
