/**
 * Return true if a log scale is likely appropriate.
 *
 * @param data - numeric array
 * @param opts.minOrders - minimum orders of magnitude spanned to recommend log scale
 * @param opts.ignoreFraction - optional fraction (0–0.5) of extreme values to drop from both ends
 */
export default function shouldUseLogScale(
  data: number[],
  opts: { minOrders?: number; ignoreFraction?: number } = {}
): boolean {
  const { minOrders = 3, ignoreFraction = 0 } = opts;

  // Filter strictly positive values (log scale requirement)
  const positives: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (d > 0) positives.push(d);
  }
  if (positives.length === 0) return false;

  // Optionally trim extreme outliers (symmetric)
  let filtered = positives;
  if (ignoreFraction > 0) {
    const sorted = [...positives].sort((a, b) => a - b);
    const trim = Math.floor(sorted.length * ignoreFraction);
    filtered = sorted.slice(trim, sorted.length - trim);
  }

  if (filtered.length === 0) return false;

  // Safe min/max (no spread)
  let min = filtered[0];
  let max = filtered[0];

  for (let i = 1; i < filtered.length; i++) {
    const v = filtered[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Avoid division by numbers extremely close to 0
  if (min <= 0) return false;

  const orders = Math.log10(max / min);
  return orders >= minOrders;
}
