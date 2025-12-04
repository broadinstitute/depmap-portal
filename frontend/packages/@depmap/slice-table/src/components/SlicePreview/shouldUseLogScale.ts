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
  const positives = data.filter((d) => d > 0);
  if (positives.length === 0) return false;

  // Optionally trim extreme outliers (symmetric)
  let filtered = positives;
  if (ignoreFraction > 0) {
    const sorted = [...positives].sort((a, b) => a - b);
    const trim = Math.floor(sorted.length * ignoreFraction);
    filtered = sorted.slice(trim, sorted.length - trim);
  }

  if (filtered.length === 0) return false;

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);

  // Avoid division by numbers extremely close to 0
  if (min <= 0) return false;

  const orders = Math.log10(max / min);
  return orders >= minOrders;
}
