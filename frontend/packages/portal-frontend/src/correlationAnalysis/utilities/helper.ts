import { SortedCorrelations } from "../models/CorrelationPlot";

export function transformAndGroupByDataset(
  associationsData: {
    correlation: number;
    log10qvalue: number;
    other_dataset_id: string;
    other_dimension_given_id: string;
    other_dimension_label: string;
  }[],
  compoundDoseLabel: string,
  datasetLookup: Record<string, string>,
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
        id: `${compoundDoseLabel}-${item.other_dimension_label}`, // compound dose and correlated feature pair should be unique
        feature: item.other_dimension_label,
        dose: compoundDoseToDose.get(compoundDoseLabel),
        featureDataset: datasetLookup[item.other_dataset_id],
        correlation: item.correlation, //parseFloat(item.correlation.toFixed(2)),
        log10qvalue: item.log10qvalue, //parseFloat(item.log10qvalue.toFixed(2)),
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
    { hex: "#ADFF2F" }, // Yellow-Green
    { hex: "#97E34F" },
    { hex: "#81C76E" },
    { hex: "#6BAB8D" },
    { hex: "#559FAC" },
    { hex: "#4083CC" },
    { hex: "#3365B6" },
    { hex: "#26479F" },
    { hex: "#1A2A89" },
    { hex: "#4B0082" }, // Dark Purple
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
