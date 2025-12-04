import { SortedCorrelations } from "../models/CorrelationPlot";

export function transformAndGroupByDataset(
  associationsData: {
    correlation: number;
    log10qvalue: number;
    other_dataset_id: string;
    other_dimension_given_id: string;
    other_dimension_label: string;
  }[],
  featureId: string,
  datasetLookup: Record<string, string>,
  datasetGivenIdLookup: Record<string, string>,
  compoundDoseToDose: Map<string, string>
) {
  const grouped: Map<
    string,
    {
      correlation: number;
      log10qvalue: number;
      other_dataset_id: string;
      other_dimension_given_id: string;
      other_dimension_label: string;
    }[]
  > = new Map();

  // Step 1: Group items by other_dataset_id
  associationsData.forEach((item) => {
    const group = grouped.get(item.other_dataset_id) || [];
    group.push(item);
    grouped.set(item.other_dataset_id, group);
  });

  // Step 2: For each group, sort by correlation and assign rank
  const result: Record<string, SortedCorrelations[]> = {};

  // eslint-disable-next-line no-restricted-syntax
  for (const [datasetId, items] of grouped.entries()) {
    const datasetName = datasetLookup[datasetId];
    const sorted = items
      .slice()
      .sort((a, b) => b.correlation - a.correlation)
      .map((item, index: number) => ({
        ...item,
        id: `${item.other_dataset_id}-${item.other_dimension_label}-${featureId}`, // correlated dataset, correlated feature and given feature dose should be unique
        feature: item.other_dimension_label,
        dose: compoundDoseToDose.get(featureId),
        featureDataset: datasetLookup[item.other_dataset_id],
        featureDatasetGivenId: datasetGivenIdLookup[item.other_dataset_id],
        correlation: item.correlation,
        log10qvalue: item.log10qvalue,
        rank: index + 1,
      }));

    result[datasetName] = sorted;
  }

  return result;
}

export function getAllCorrelates(
  data: Record<string, Record<string, SortedCorrelations[]>>
) {
  return Object.values(data)
    .flatMap((inner) => Object.values(inner))
    .flat();
}

export function createDoseRangeColorScale(
  doses: string[]
): { hex: string | undefined; dose: string }[] {
  const colorScale = [
    { hex: "#d8f900ff" },
    { hex: "#1eff00ff" },
    { hex: "#3CB371" },
    { hex: "#00CED1" },
    { hex: "#1E90FF" },
    { hex: "#4169E1" },
    { hex: "#0000CD" },
    { hex: "#00008B" },
    { hex: "#191970" },
    { hex: "#aec7e8" },
    { hex: "#ffbb78" },
    { hex: "#98df8a" },
    { hex: "#ff9896" },
    { hex: "#c5b0d5" },
    { hex: "#c49c94" },
    { hex: "#f7b6d2" },
    { hex: "#c7c7c7" },
    { hex: "#dbdb8d" },
    { hex: "#9edae5" },
    { hex: "#59a14f" },
    { hex: "#f28e2c" },
    { hex: "#4e79a7" },
    { hex: "#e15759" },
    { hex: "#76b7b2" },
    { hex: "#597a7a" },
    { hex: "#edc948" },
    { hex: "#b07aa1" },
    { hex: "#ffc078" },
    { hex: "#bab0ac" },
  ];

  const sortedDoses = doses.sort((a: any, b: any) => {
    return a - b;
  });
  return sortedDoses.map((dose, i) => {
    if (i >= colorScale.length) {
      return { hex: undefined, dose };
    }

    return { ...colorScale[i], dose };
  });
}

// Define the core regex pattern for extracting the number part (Group 1)
// This pattern includes optional sign, decimal point, and scientific notation.
const NUMERIC_REGEX_PATTERN = /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/;

// Define the full regex that captures Group 1 (Number) and Group 2 (Units).
// This is used for unit splitting in formatDoseString.
const FULL_SPLIT_REGEX = new RegExp(NUMERIC_REGEX_PATTERN.source + "\\s*(.*)$");

/**
 * Parses a numeric value from a dose string, handling variations like units,
 * commas for decimals, and mixed formatting.
 * * @param doseString The dose string (e.g., "0.1 um", "0,1 s").
 * @returns The parsed number, or null if no valid number is found.
 */
function parseDoseValue(doseString: string): number | null {
  if (!doseString) {
    return null;
  }

  // 1. Replace comma decimal separators with period decimal separators
  let cleanString = doseString.replace(",", ".");

  // 2. Use the defined constant regex to extract the number part.
  const match = cleanString.match(NUMERIC_REGEX_PATTERN);

  if (match) {
    const rawNumberStr = match[1];
    const numberValue = parseFloat(rawNumberStr);

    if (isNaN(numberValue)) {
      return null;
    }
    return numberValue;
  }

  // If no number is found at the start
  return null;
}

/**
 * Extracts a leading number from a string, rounds it to 4 decimal places,
 * and reattaches the original units/text. If no number is found,
 * the original string is returned.
 *
 * @param input The dose string, e.g., "0.0010005269850663 uM" or "AUC".
 * @returns The formatted string, e.g., "0.0010 uM" or "AUC".
 */
export function formatDoseString(input: string | undefined): string {
  if (!input) {
    return "";
  }

  if (typeof input !== "string") return String(input);

  // 1. Handle comma replacement (moved from parseDoseValue call)
  let cleanInput = input.replace(",", ".");

  // 2. Use the single, pre-compiled regex to get the number and units in one pass.
  const match = cleanInput.match(FULL_SPLIT_REGEX);

  if (!match) {
    // No number found at the start (e.g., "AUC", "N/A")
    return input;
  }

  const rawNumberStr = match[1];
  const units = match[2];

  const numberValue = parseFloat(rawNumberStr);

  if (Number.isNaN(numberValue)) {
    // Should not happen if regex matches, but as a safety fallback
    return input;
  }

  // 1. Round to 4 decimal places and get the new string representation
  // Use parseFloat(toFixed(4)).toString() to remove trailing zeros after rounding
  const roundedNumberStr = parseFloat(numberValue.toFixed(4)).toString();

  // 2. Reconstruct the string: rounded number + space (optional) + units
  if (units.length > 0 && units.trim().length > 0) {
    // Add a space only if units are present and non-empty
    return `${roundedNumberStr} ${units}`;
  }
  // No units, just return the rounded number
  return roundedNumberStr;
}

/**
 * Sorts an array of DoseColor objects ascendingly based on the numeric
 * value extracted from the 'dose' string, prioritizing "AUC" first.
 *
 * @param doseColors The array of dose colors to sort.
 * @returns A new array containing the sorted DoseColor objects.
 */
export function sortDoseColorsByValue(
  doseColors: { hex: string | undefined; dose: string }[]
): { hex: string | undefined; dose: string }[] {
  // Always create a shallow copy to maintain immutability (best practice in React/TS)
  const sortedArray = [...doseColors];

  sortedArray.sort((a, b) => {
    // 1. Prioritize "AUC" over all other values (numeric or non-numeric)
    const isAUCA = a.dose === "AUC";
    const isAUCB = b.dose === "AUC";

    if (isAUCA && !isAUCB) return -1; // A is AUC, A comes first
    if (!isAUCA && isAUCB) return 1; // B is AUC, B comes first
    if (isAUCA && isAUCB) return 0; // Both are AUC

    // 2. Fallback to Numeric Sorting (using parsed values)
    const valueA = parseDoseValue(a.dose);
    const valueB = parseDoseValue(b.dose);

    // Handle cases where parsing fails (treat nulls as lowest priority/largest number for consistent sorting)
    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1; // 'a' moves to the end
    if (valueB === null) return -1; // 'b' moves to the end

    // Ascending numeric sort
    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
    return 0;
  });

  return sortedArray;
}
