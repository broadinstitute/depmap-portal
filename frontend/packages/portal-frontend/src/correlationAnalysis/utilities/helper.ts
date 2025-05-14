export function transformAndGroupByDataset(
  associationsData: {
    correlation: number;
    log10qvalue: number;
    other_dataset_id: string;
    other_dimension_given_id: string;
    other_dimension_label: string;
  }[],
  compoundDoseLabel: string,
  datasetLookup: Record<string, string>
) {
  const grouped: Map<string, any[]> = new Map();

  // Step 1: Group items by other_dataset_id
  associationsData.forEach((item) => {
    const group = grouped.get(item.other_dataset_id) || [];
    group.push(item);
    grouped.set(item.other_dataset_id, group);
  });

  // Step 2: For each group, sort by correlation and assign rank
  const result: Record<string, any[]> = {};

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
        featureDataset: datasetLookup[item.other_dataset_id],
        correlation: parseFloat(item.correlation.toFixed(2)),
        log10qvalue: parseFloat(item.log10qvalue.toFixed(2)),
        rank: index + 1,
      }));

    result[datasetName] = sorted;
  }

  return result;
}
