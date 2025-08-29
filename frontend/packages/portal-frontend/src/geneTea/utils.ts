import { breadboxAPI, cached } from "@depmap/api";
import { HeatmapFormattedData } from "@depmap/types/src/experimental_genetea";

export const tableColumns = [
  { accessor: "term", Header: "Term", minWidth: 100 },
  {
    accessor: "termGroup",
    Header: "Term Group",
    minWidth: 180,
  },
  {
    accessor: "fdr",
    Header: "FDR",
    minWidth: 80,
  },
  {
    accessor: "effectSize",
    Header: "Effect Size",
    minWidth: 80,
  },
  {
    accessor: "matchingGenesInList",
    Header: "Matching Query",
    minWidth: 100,
  },
  {
    accessor: "nMatchingGenesInList",
    Header: "n Matching Query",
  },
  {
    accessor: "nMatchingGenesOverall",
    Header: "n Matching Overall",
  },
  {
    accessor: "synonyms",
    Header: "Synonyms",
    minWidth: 200,
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

export function generateTickLabels(
  columnNames: string[],
  selectedColumnIndices: Set<number>
): string[] {
  // Initialize output array with empty strings
  const tickvals: string[] = new Array(columnNames.length).fill("");

  if (selectedColumnIndices.size === 0) {
    return tickvals;
  }

  // Convert Set to sorted array for easier processing
  const sortedIndices = Array.from(selectedColumnIndices).sort((a, b) => a - b);

  // Find contiguous subsets
  const contiguousSubsets: number[][] = [];
  let currentSubset: number[] = [sortedIndices[0]];

  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] === sortedIndices[i - 1] + 1) {
      // Contiguous - add to current subset
      currentSubset.push(sortedIndices[i]);
    } else {
      // Not contiguous - start new subset
      contiguousSubsets.push(currentSubset);
      currentSubset = [sortedIndices[i]];
    }
  }
  // Don't forget the last subset
  contiguousSubsets.push(currentSubset);

  // For each subset, find middle index and place subset size there
  contiguousSubsets.forEach((subset) => {
    if (subset.length === 1) {
      subset.forEach((j) => {
        tickvals[j] = columnNames[j];
      });
    } else {
      const middleIndex = Math.floor((subset.length - 1) / 2);
      const actualColumnIndex = subset[middleIndex];
      tickvals[actualColumnIndex] = `(${subset.length.toString()})`;
    }
  });

  return tickvals;
}

export function getSelectedColumns(
  heatmapData: HeatmapFormattedData,
  selectedGenes: Set<string>
) {
  const uniqueXs = new Set(heatmapData.x);
  const out = new Set<number>();
  [...uniqueXs].forEach((x: string, index: number) => {
    if (x !== null && selectedGenes.has(x)) {
      out.add(index);
    }
  });
  return out;
}
