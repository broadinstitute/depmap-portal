import { breadboxAPI, cached } from "@depmap/api";

export const tableColumns = [
  { accessor: "term", Header: "Term", maxWidth: 120, minWidth: 80 },
  {
    accessor: "termGroup",
    Header: "Term Group",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "fdr",
    Header: "FDR",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "effectSize",
    Header: "Effect Size",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "matchingGenesInList",
    Header: "Matching Query",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "nMatchingGenesInList",
    Header: "n Matching Query",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "nMatchingGenesOverall",
    Header: "n Matching Overall",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "synonyms",
    Header: "Synonyms",
    maxWidth: 120,
    minWidth: 80,
  },
];

export function groupStringsByCondition(
  strings: string[],
  condition: (str: string) => boolean
): [Set<string>, Set<string>] {
  return strings.reduce(
    (lists: [Set<string>, Set<string>], currentString: string) => {
      if (condition(currentString)) {
        lists[0].add(currentString); // Add to the first set if condition is true
      } else {
        lists[1].add(currentString); // Add to the second set if condition is false
      }
      return lists;
    },
    [new Set([]), new Set([])] // Initialize with two empty string sets
  );
}

// TODO: move this and the fetchMetadata used by Dose Curves
// and the Heatmap into a shared frontend module!!!
export async function fetchMetadata<T>(
  typeName: string,
  indices: string[] | null,
  columns: string[] | null,
  bbapi: typeof breadboxAPI,
  identifier: "label" | "id" = "id"
) {
  const dimType = await cached(bbapi).getDimensionType(typeName);
  if (!dimType?.metadata_dataset_id) {
    throw new Error(`No metadata for ${typeName}`);
  }

  let args;
  if (indices && indices.length > 0) {
    args = { indices, identifier, columns };
  } else {
    args = { indices: null, identifier: null, columns };
  }
  return cached(bbapi).getTabularDatasetData(
    dimType.metadata_dataset_id,
    args
  ) as Promise<T>;
}
