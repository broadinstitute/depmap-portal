import { sampleCorrelation } from "simple-statistics";
import jstat from "jstat";

interface PearsonRResult {
  statistic: number;
  pvalue: number;
}

export function pearsonr(
  xs: (number | null)[],
  ys: (number | null)[]
): PearsonRResult {
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

  const r = sampleCorrelation(x, y);

  // Compute t-statistic
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r ** 2);
  // Compute two-tailed p-value
  const pvalue = 2 * (1 - jstat.studentt.cdf(Math.abs(t), n - 2));

  return {
    statistic: r,
    pvalue,
  };
}
