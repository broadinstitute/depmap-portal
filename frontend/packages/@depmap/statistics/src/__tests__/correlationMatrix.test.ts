import {
  clusterCorrelationMatrix,
  correlationMatrix,
} from "../correlationMatrix";

// Build a lookup table: col1 → col2 → correlation value.
// This lets tests find the correlation between two named columns without
// caring about their position in the (potentially reordered) result.
function buildLookup(result: {
  columns: string[];
  matrix: number[][];
}): Record<string, Record<string, number>> {
  const lookup: Record<string, Record<string, number>> = {};
  result.columns.forEach((col1, i) => {
    lookup[col1] = {};
    result.columns.forEach((col2, j) => {
      lookup[col1][col2] = result.matrix[i][j];
    });
  });
  return lookup;
}

// Fixture: A and B are perfectly correlated; C is perfectly anti-correlated
// with both. Distance matrix: d(A,B)=0, d(A,C)=d(B,C)=2, d(A,A)=0 etc.
// Clustering should always place A and B adjacent.
const perfectTriple = {
  columns: ["A", "B", "C"],
  matrix: [
    [1, 1, -1],
    [1, 1, -1],
    [-1, -1, 1],
  ],
};

describe("clusterCorrelationMatrix", () => {
  test("result has the same number of columns and rows as the input", () => {
    const result = clusterCorrelationMatrix(perfectTriple);
    expect(result.columns.length).toBe(3);
    expect(result.matrix.length).toBe(3);
    result.matrix.forEach((row) => expect(row.length).toBe(3));
  });

  test("result contains exactly the same column names as the input", () => {
    const result = clusterCorrelationMatrix(perfectTriple);
    expect(result.columns.slice().sort()).toEqual(
      perfectTriple.columns.slice().sort()
    );
  });

  test("diagonal is 1 for every column after clustering", () => {
    const result = clusterCorrelationMatrix(perfectTriple);
    result.columns.forEach((_, i) => {
      expect(result.matrix[i][i]).toBeCloseTo(1, 10);
    });
  });

  test("matrix is symmetric after clustering", () => {
    const result = clusterCorrelationMatrix(perfectTriple);
    const n = result.matrix.length;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        expect(result.matrix[i][j]).toBeCloseTo(result.matrix[j][i], 10);
      }
    }
  });

  // This is the core regression: the correlation value between any pair of
  // named columns must be the same before and after clustering — it should
  // just appear at a different (i, j) position in the reordered matrix.
  // A heatmap selection stores column *names* (IDs); when clustering changes
  // their visual positions the displayed value must not change.
  test("pairwise correlation values are preserved after reordering", () => {
    const before = buildLookup(perfectTriple);
    const after = buildLookup(clusterCorrelationMatrix(perfectTriple));

    perfectTriple.columns.forEach((col1) => {
      perfectTriple.columns.forEach((col2) => {
        expect(after[col1][col2]).toBeCloseTo(before[col1][col2], 10);
      });
    });
  });

  // Similar items should end up adjacent. With ρ(A,B)=1 and ρ(A,C)=ρ(B,C)=-1,
  // A and B are the closest pair and must be neighbors in the clustered output.
  test("groups the most-similar pair adjacent", () => {
    const result = clusterCorrelationMatrix(perfectTriple);
    const posA = result.columns.indexOf("A");
    const posB = result.columns.indexOf("B");
    expect(Math.abs(posA - posB)).toBe(1);
  });

  // Verify the alignment contract directly: matrix[i][j] == correlation
  // between columns[i] and columns[j], not between whatever was at position
  // (i, j) before clustering.
  test("matrix[i][j] equals the correlation between columns[i] and columns[j]", () => {
    const expected: Record<string, Record<string, number>> = {
      A: { A: 1, B: 1, C: -1 },
      B: { A: 1, B: 1, C: -1 },
      C: { A: -1, B: -1, C: 1 },
    };

    const result = clusterCorrelationMatrix(perfectTriple);
    result.columns.forEach((col1, i) => {
      result.columns.forEach((col2, j) => {
        expect(result.matrix[i][j]).toBeCloseTo(expected[col1][col2], 10);
      });
    });
  });
});

describe("correlationMatrix", () => {
  // Raw data matching the perfectTriple fixture above.
  const data = {
    A: [1, 2, 3, 4],
    B: [1, 2, 3, 4], // identical to A → ρ = 1
    C: [4, 3, 2, 1], // reversed → ρ = -1 vs A and B
  };

  test("without clustering: diagonal is 1 and off-diagonal is ±1", () => {
    const result = correlationMatrix(data, false);
    result.columns.forEach((_, i) => {
      expect(result.matrix[i][i]).toBeCloseTo(1, 5);
    });
    const lookup = buildLookup(result);
    expect(lookup.A.B).toBeCloseTo(1, 5);
    expect(lookup.A.C).toBeCloseTo(-1, 5);
    expect(lookup.B.C).toBeCloseTo(-1, 5);
  });

  // Toggling clustering must not change the correlation value between any
  // named pair of columns — only their positions in the matrix should differ.
  test("with clustering: pairwise values match the unclustered result", () => {
    const unclustered = buildLookup(correlationMatrix(data, false));
    const clustered = buildLookup(correlationMatrix(data, true));

    Object.keys(data).forEach((col1) => {
      Object.keys(data).forEach((col2) => {
        expect(clustered[col1][col2]).toBeCloseTo(unclustered[col1][col2], 5);
      });
    });
  });

  test("with clustering: A and B are placed adjacent", () => {
    const result = correlationMatrix(data, true);
    const posA = result.columns.indexOf("A");
    const posB = result.columns.indexOf("B");
    expect(Math.abs(posA - posB)).toBe(1);
  });
});
