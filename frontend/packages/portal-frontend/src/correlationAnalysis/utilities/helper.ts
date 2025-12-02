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

export function formatDoseString(input: string | undefined): string {
  if (!input) {
    return "";
  }

  if (typeof input !== "string") return String(input);

  // Regex breakdown:
  // /^(\d*\.?\d+)/   -> Group 1 (the number): Matches a number starting from the beginning of the string.
  //                     - ^: Start of string
  //                     - \d*: Zero or more digits (for cases like .5)
  //                     - \.?: Optional decimal point
  //                     - \d+: One or more digits after decimal/start
  // /(.*)$/         -> Group 2 (the units/remainder): Matches the rest of the string until the end.
  const match = input.match(/^(\d*\.?\d+)\s*(.*)$/);

  if (match) {
    const rawNumberStr = match[1];
    const units = match[2];

    // Attempt to parse the number
    const numberValue = parseFloat(rawNumberStr);

    if (Number.isNaN(numberValue)) {
      // Should not happen if regex matches, but as a safety fallback
      return input;
    }

    // 1. Round to 4 decimal places and get the new string representation
    // (Wrap toFixed with a parseFloat before convering back toString to avoid trailing zeros. This
    // is important to maintain consistent with the doses displayed on the Heatmap and Dose Curve tabs (see useDoseViabilityData.ts).)
    const roundedNumberStr = parseFloat(numberValue.toFixed(4)).toString();

    // 2. Reconstruct the string: rounded number + space (optional) + units
    if (units.length > 0) {
      // Add a space only if units are present
      return `${roundedNumberStr} ${units}`;
    }
    // No units, just return the rounded number
    return roundedNumberStr;
  }
  // No number found at the start of the string (e.g., "AUC" or "N/A")
  return input;
}
