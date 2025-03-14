import { agnes, AgnesOptions } from "ml-hclust";
import { pearsonr } from "./scipy/pearsonr";

interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
}

export function clusterCorrelationMatrix(
  corrMatrix: CorrelationMatrix
): CorrelationMatrix {
  // Convert correlation to distance matrix
  const distanceMatrix = corrMatrix.matrix.map((row) =>
    row.map((corr) => 1 - Math.abs(corr))
  );

  // Prepare options for agnes
  const options: AgnesOptions<number[]> = {
    method: "average",
    isDistanceMatrix: true,
  };

  // Perform hierarchical clustering
  const clustering = agnes(distanceMatrix, options);

  // Get the order of leaves (reordered indices)
  const reorderedIndices = clustering.indices();

  // Reorder columns and matrix
  const newColumns = reorderedIndices.map((idx) => corrMatrix.columns[idx]);
  const newMatrix = reorderedIndices.map((rowIdx) =>
    reorderedIndices.map((colIdx) => corrMatrix.matrix[rowIdx][colIdx])
  );

  return {
    columns: newColumns,
    matrix: newMatrix,
  };
}

export function correlationMatrix(
  data: Record<string, number[]>,
  useClustering?: boolean
) {
  const keys = Object.keys(data);

  const matrix = keys.map((col1) =>
    keys.map((col2) =>
      col1 === col2 ? 1 : pearsonr(data[col1], data[col2]).statistic
    )
  );

  const corrMatrix = { columns: keys, matrix };

  return useClustering ? clusterCorrelationMatrix(corrMatrix) : corrMatrix;
}
