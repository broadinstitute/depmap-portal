export function generateTickLabels(
  columnNames: string[],
  selectedColumnIndices: Set<number>,
  pixelDistanceBetweenColumns: number
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
    if (subset.length === 1 || pixelDistanceBetweenColumns > 20) {
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
