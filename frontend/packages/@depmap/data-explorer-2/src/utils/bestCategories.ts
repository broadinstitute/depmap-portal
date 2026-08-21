// ---------------------------------------------------------------------------
// Choosing which categories get their own color or facet panel.
//
// A plot can show far more distinct values than it has colors or screen space,
// so some of them have to be collapsed together. Which ones is the question.
// Collapsing everything past the first N alphabetically picks by an accident of
// spelling; keeping the N biggest groups picks the ones you could already have
// named, and swallows the small distinctive group, which is usually the one
// worth seeing.
//
// So: keep the categories that sit somewhere distinctive *in this plot*. A
// lineage earns a color because its points are somewhere the others aren't,
// measured on the axes actually being drawn. Interestingness is relational —
// the same annotation deserves different colors on different plots.
//
// Everything here is pure and needs no network. The plot response already
// carries each point's category alongside its x/y values, index-aligned, so
// this is arithmetic over data in hand.
// ---------------------------------------------------------------------------

import { IDENTIFIER_LIKE_RATIO } from "../constants/plotConstants";

// The precondition for everything below: is this a categorical annotation at
// all, or is it an identifier wearing one's type? Past IDENTIFIER_LIKE_RATIO
// the average group holds fewer than two items, so scoring the categories is
// arithmetic without meaning — every group is a singleton sitting exactly where
// its one point sits, and picking the "best" 16 of them just names 16 items.
//
// Deliberately a ratio and not a count. 300 distinct lineages across 2,000
// models is an annotation with more values than colors, which is ordinary and
// handled by ranking; 300 across 320 is a primary key, which no amount of
// ranking rescues. The whole range between the palette's 18 colors and this
// line is the former.
//
// `describedCount` counts items that actually carry a value, not every item of
// the type: a column filled in for 300 of 2,000 models with 300 distinct values
// is a key for the part of the cohort it describes, and counting the blanks
// would disguise that.
export function isIdentifierLike(
  distinctCount: number,
  describedCount: number
) {
  if (describedCount <= 0) {
    return false;
  }

  return distinctCount > IDENTIFIER_LIKE_RATIO * describedCount;
}

// Below this many points a category has no trustworthy position — two points
// can sit anywhere. The t-statistic below already discounts small groups
// smoothly; this is only a floor for the degenerate end, where the statistic
// is undefined rather than merely weak.
const MIN_POINTS_TO_SCORE = 3;

export interface CategoryScore {
  category: string;
  // Points that are visible and plottable on every axis in play — the ones the
  // plot will actually draw for this category.
  count: number;
  // Mean position per axis, parallel to the `axes` argument. Shown in the
  // picker so the ranking can be checked rather than trusted.
  means: (number | null)[];
  // Combined separation from everything else. Larger is more distinctive.
  score: number;
}

interface Accumulator {
  count: number;
  sums: number[];
  sumSquares: number[];
}

// Separation of a group from the rest, in units of pooled standard error — the
// two-sample t-statistic. Two things recommend it over a plain difference of
// means. It is scale-free, so axes in different units can be combined. And the
// standard error carries `sqrt(1/n)`, which means a group of three with an
// extreme mean scores well below a group of three hundred with the same mean:
// the size weighting is built into the statistic rather than bolted on as a
// separate rule that would need its own threshold.
function separation(
  count: number,
  sum: number,
  sumSquares: number,
  totalCount: number,
  totalSum: number,
  totalSumSquares: number
) {
  const restCount = totalCount - count;

  if (count < MIN_POINTS_TO_SCORE || restCount < MIN_POINTS_TO_SCORE) {
    return 0;
  }

  const mean = sum / count;
  const restMean = (totalSum - sum) / restCount;

  // Sum of squared deviations, each about its own mean.
  const ss = sumSquares - count * mean * mean;
  const restSs = totalSumSquares - sumSquares - restCount * restMean * restMean;

  const degreesOfFreedom = totalCount - 2;
  const pooledVariance = Math.max(0, ss + restSs) / degreesOfFreedom;

  if (pooledVariance <= 0) {
    // Neither group varies internally. Either they sit on top of each other —
    // no separation at all — or they are perfectly separated, with no overlap
    // possible. The second is the strongest evidence there is, not the weakest,
    // so it must not fall through to a zero. Reachable on a binary or otherwise
    // discrete-valued axis.
    return mean === restMean ? 0 : Infinity;
  }

  const standardError = Math.sqrt(pooledVariance * (1 / count + 1 / restCount));

  return Math.abs(mean - restMean) / standardError;
}

// `axes` is the numeric data being plotted — x, or x and y — each parallel to
// `catValues`. Pass none (a correlation heatmap has no per-point position) and
// scoring falls back to group size, which is the only signal left.
export function scoreCategories(
  catValues: (string | null)[],
  axes: (number | null)[][],
  visible: boolean[]
): CategoryScore[] {
  // A point counts only where the plot would draw it: visible, and non-null on
  // every axis. Scoring on points that won't appear would rank categories by a
  // picture nobody is looking at.
  const participates = catValues.map((category, i) => {
    if (category === null || !visible[i]) {
      return false;
    }

    return axes.every((values) => values[i] !== null);
  });

  const byCategory = new Map<string, Accumulator>();
  const total: Accumulator = {
    count: 0,
    sums: axes.map(() => 0),
    sumSquares: axes.map(() => 0),
  };

  for (let i = 0; i < catValues.length; i += 1) {
    if (!participates[i]) {
      continue;
    }

    const category = catValues[i] as string;
    let acc = byCategory.get(category);

    if (!acc) {
      acc = {
        count: 0,
        sums: axes.map(() => 0),
        sumSquares: axes.map(() => 0),
      };
      byCategory.set(category, acc);
    }

    acc.count += 1;
    total.count += 1;

    for (let a = 0; a < axes.length; a += 1) {
      const value = axes[a][i] as number;
      acc.sums[a] += value;
      acc.sumSquares[a] += value * value;
      total.sums[a] += value;
      total.sumSquares[a] += value * value;
    }
  }

  return [...byCategory.entries()].map(([category, acc]) => {
    const means = acc.sums.map((sum) =>
      acc.count > 0 ? sum / acc.count : null
    );

    if (axes.length === 0) {
      // No position to be distinctive in. Size is all that is left, and it at
      // least keeps the ordering stable and explicable.
      return { category, count: acc.count, means, score: acc.count };
    }

    // Combined as a Euclidean length over axes, so a category distinctive on
    // one axis is kept even when it is unremarkable on the other. Summing would
    // let a strong x and a strong y trade against each other, which is not what
    // "stands out" means when you are looking at a scatter plot.
    const sumOfSquares = axes.reduce((running, _, a) => {
      const t = separation(
        acc.count,
        acc.sums[a],
        acc.sumSquares[a],
        total.count,
        total.sums[a],
        total.sumSquares[a]
      );

      return running + t * t;
    }, 0);

    return {
      category,
      count: acc.count,
      means,
      score: Math.sqrt(sumOfSquares),
    };
  });
}

// The survivors, in alphabetical order rather than score order.
//
// Ranking decides *which* categories, never how they are arranged — color
// assignment stays alphabetical as it has always been. Otherwise changing an
// axis would reshuffle every swatch in the legend along with deciding which
// categories earned one, and a reader would have no fixed point at all.
export function selectBestCategories(
  scores: CategoryScore[],
  cap: number,
  // A comparator rather than an Intl.Collator: the ordering these labels want
  // is not one Intl can express (see compareNaturally), and the narrower type
  // says all this needs is "how do two labels order".
  compareLabels: (a: string, b: string) => number
): string[] {
  if (scores.length <= cap) {
    return scores.map((s) => s.category).sort(compareLabels);
  }

  return [...scores]
    .sort((a, b) => {
      if (a.score === b.score) {
        // Stable and explicable when scores tie — which they do at zero, where
        // every category too small to score lands.
        return b.count - a.count;
      }

      return b.score - a.score;
    })
    .slice(0, cap)
    .map((s) => s.category)
    .sort(compareLabels);
}
