import { linearRegression, rSquared, mean } from "simple-statistics";
import jstat from "jstat";

interface LinregressResult {
  slope: number;
  intercept: number;
  rvalue: number;
  pvalue: number;
  stderr: number;
  intercept_stderr: number;
}

export function linregress(
  xs: (number | null)[],
  ys: (number | null)[]
): LinregressResult {
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
      slope: Number.NaN,
      intercept: Number.NaN,
      rvalue: Number.NaN,
      pvalue: Number.NaN,
      stderr: Number.NaN,
      intercept_stderr: Number.NaN,
    };
  }

  const xyPairs = x.map((xi, i) => [xi, y[i]]);
  const { m, b } = linearRegression(xyPairs);

  const rSq = rSquared(xyPairs, (xi) => m * xi + b);
  const rvalue = Math.sqrt(rSq) * (m >= 0 ? 1 : -1);

  // Predicted values
  const yHat = x.map((xi) => m * xi + b);

  // Compute residuals
  const residuals = y.map((yi, i) => yi - yHat[i]);

  // Standard error of residuals (stderr)
  const residualSumSquares = residuals.reduce((sum, r) => sum + r ** 2, 0);
  const stderr = Math.sqrt(residualSumSquares / (n - 2));

  // Compute standard error of the slope (SE_m)
  const xMean = mean(x);
  const sumSquaredDiffs = x.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);
  const SE_m = stderr / Math.sqrt(sumSquaredDiffs);

  // Compute t-statistic
  const t = m / SE_m;

  // Compute two-tailed p-value
  const pvalue = 2 * (1 - jstat.studentt.cdf(Math.abs(t), n - 2));

  // Compute standard error of the intercept (SE_b)
  const sumXSquared = x.reduce((sum, xi) => sum + xi ** 2, 0);
  const intercept_stderr = SE_m * Math.sqrt(sumXSquared / n);

  return {
    slope: m,
    intercept: b,
    rvalue,
    pvalue,
    stderr,
    intercept_stderr,
  };
}
