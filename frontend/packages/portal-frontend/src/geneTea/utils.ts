import { breadboxAPI, cached } from "@depmap/api";

export const tableColumns = [
  {
    accessor: "term",
    Header: "Term",
    helperText:
      "The '~' prefix indicates a synonym set, with sub-terms defined in the ‘Synonyms’ column.",
    minWidth: 100,
  },
  {
    accessor: "termGroup",
    Header: "Term Group",
    helperText:
      "The '++' suffix indicates the term is a member of a group. All terms in a group share the same value in this column.",
    minWidth: 180,
  },
  {
    accessor: "fdr",
    Header: "FDR",
    helperText:
      "False discovery rate value, from Benjamini-Hochberg correction of hypergeometric test p-values.",
    minWidth: 80,
  },
  {
    accessor: "effectSize",
    Header: "Effect Size",
    helperText:
      "Sum of tf-idf across query genes. This measures the total information encoded by this term for the query, and approximates its specificity.",
    minWidth: 80,
  },
  {
    accessor: "matchingGenesInList",
    Header: "Matching Query",
    helperText: "Genes in query whose descriptions contain the term.",
    minWidth: 100,
  },
  {
    accessor: "nMatchingGenesInList",
    Header: "n Matching Query",
    helperText: "Number of genes in query whose descriptions contain the term.",
  },
  {
    accessor: "nMatchingGenesOverall",
    Header: "n Matching Overall",
    helperText:
      "Number of genes in background whose descriptions contain the term. This defines how common a term is.",
  },
  {
    accessor: "synonyms",
    Header: "Synonyms",
    helperText: "Semicolon-separated list of terms making up a synonym set.",
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
  selectedColumnIndices: Set<number>,
  showFullXAxisTickLabels: boolean
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
    if (subset.length === 1 || showFullXAxisTickLabels) {
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
