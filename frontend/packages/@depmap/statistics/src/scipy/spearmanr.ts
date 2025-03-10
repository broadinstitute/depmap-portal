import { sampleCorrelation } from "simple-statistics";
import jstat from "jstat";

interface SignificanceResult {
  statistic: number;
  pvalue: number;
}

function calculateRanks(arr: number[]) {
  // Create array of indices and values
  const indexed = arr.map((value, index) => ({ value, index }));

  // Sort by values
  indexed.sort((a, b) => a.value - b.value);

  // Calculate ranks (handling ties by averaging)
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    const value = indexed[i].value;
    let j = i + 1;
    // Find ties
    while (j < indexed.length && indexed[j].value === value) {
      j++;
    }
    // Calculate average rank for ties
    const rank = (i + (j - 1)) / 2 + 1;
    // Assign rank to all tied values
    for (let k = i; k < j; k++) {
      ranks[indexed[k].index] = rank;
    }
    i = j;
  }

  return ranks;
}

export function spearmanr(
  xs: (number | null)[],
  ys: (number | null)[]
): SignificanceResult {
  if (xs.length !== ys.length) {
    throw new Error("x and y must have the same length");
  }

  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < xs.length; i += 1) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      x.push(xs[i] as number);
      y.push(ys[i] as number);
    }
  }

  const n = x.length;

  if (n < 3) {
    return {
      statistic: Number.NaN,
      pvalue: Number.NaN,
    };
  }

  // Spearman Rank Correlation
  const xRanks = calculateRanks(x);
  const yRanks = calculateRanks(y);
  const rho = sampleCorrelation(xRanks, yRanks);

  // Compute t-statistic
  const t = (rho * Math.sqrt(n - 2)) / Math.sqrt(1 - rho ** 2);

  // Compute two-tailed p-value
  const pvalue = 2 * (1 - jstat.studentt.cdf(Math.abs(t), n - 2));

  return {
    statistic: rho,
    pvalue,
  };
}
