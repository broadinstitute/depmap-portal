import { compareNaturally } from "@depmap/utils";
import {
  isIdentifierLike,
  scoreCategories,
  selectBestCategories,
} from "../bestCategories";

describe("isIdentifierLike", () => {
  it("accepts an annotation with far more values than colors", () => {
    // The case the old 300-value gate got wrong. This is ordinary: more values
    // than the palette holds, but each one still names a real group. Ranking
    // and bucketing handle it at render time.
    expect(isIdentifierLike(300, 2000)).toBe(false);
  });

  it("rejects a column that names items rather than grouping them", () => {
    // Same 300 values, a fifteenth of the cohort. The average group is now
    // barely larger than one, so there is nothing for a ranking to prefer.
    expect(isIdentifierLike(300, 320)).toBe(true);
  });

  it("draws the line at one value per two items", () => {
    expect(isIdentifierLike(50, 100)).toBe(false);
    expect(isIdentifierLike(51, 100)).toBe(true);
  });

  it("is a ratio, not a count", () => {
    // Two distinct values is unambiguously a category at any real cohort size,
    // and a thousand is unambiguously fine across a large one. Neither would
    // survive a fixed threshold in both directions.
    expect(isIdentifierLike(2, 3)).toBe(true);
    expect(isIdentifierLike(2, 2000)).toBe(false);
    expect(isIdentifierLike(1000, 100000)).toBe(false);
  });

  it("says no when nothing is described", () => {
    // An empty column is handled upstream as missing data. Reporting it as an
    // identifier here would send the user to build a context over no values.
    expect(isIdentifierLike(0, 0)).toBe(false);
  });
});

// The same comparator the plot uses, so the alphabetical assertions below hold
// against what actually orders the legend.
const compareLabels = compareNaturally;

const allVisible = (n: number) => new Array(n).fill(true);

const scoreOf = (
  scores: ReturnType<typeof scoreCategories>,
  category: string
) => scores.find((s) => s.category === category)!.score;

describe("scoreCategories", () => {
  it("ranks a displaced group above an equally sized ordinary one", () => {
    // Three groups, because with exactly two every category is by construction
    // equally separated from "the rest" and the statistic correctly refuses to
    // pick between them. "shifted" and "ordinary" are the same size, so size
    // cannot be what distinguishes them.
    const spread = (i: number) => (i % 5) - 2;

    const cats = [
      ...new Array(50).fill("bulk"),
      ...new Array(10).fill("ordinary"),
      ...new Array(10).fill("shifted"),
    ];
    const x = [
      ...new Array(50).fill(0).map((_, i) => spread(i)),
      ...new Array(10).fill(0).map((_, i) => spread(i)),
      ...new Array(10).fill(0).map((_, i) => 20 + spread(i)),
    ];

    const scores = scoreCategories(cats, [x], allVisible(cats.length));

    expect(scoreOf(scores, "shifted")).toBeGreaterThan(
      scoreOf(scores, "ordinary")
    );
  });

  it("discounts a small group with the same displacement", () => {
    // The whole reason for a t-statistic rather than a difference of means:
    // three points at 20 is a weaker claim than thirty points at 20, and the
    // score should say so without needing a separate size rule.
    const background = new Array(60).fill(0).map((_, i) => (i % 5) - 2);

    const few = scoreCategories(
      [...new Array(60).fill("bulk"), ...new Array(3).fill("out")],
      [[...background, ...new Array(3).fill(20)]],
      allVisible(63)
    );

    const many = scoreCategories(
      [...new Array(60).fill("bulk"), ...new Array(30).fill("out")],
      [[...background, ...new Array(30).fill(20)]],
      allVisible(90)
    );

    expect(scoreOf(many, "out")).toBeGreaterThan(scoreOf(few, "out"));
  });

  it("scores a group too small to place at zero", () => {
    const cats = [...new Array(20).fill("bulk"), "lonely", "lonely"];
    const x = [...new Array(20).fill(0).map((_, i) => i % 4), 99, 99];

    const scores = scoreCategories(cats, [x], allVisible(cats.length));

    // Two points can sit anywhere. The statistic is undefined rather than weak,
    // so it is floored rather than trusted.
    expect(scoreOf(scores, "lonely")).toBe(0);
    expect(scores.find((s) => s.category === "lonely")!.count).toBe(2);
  });

  it("keeps a category distinctive on only one axis", () => {
    // Separated on y, unremarkable on x. Combining the axes by summing signed
    // effects could cancel this out; a Euclidean length cannot.
    const cats = [...new Array(40).fill("bulk"), ...new Array(10).fill("tall")];
    const x = [
      ...new Array(40).fill(0).map((_, i) => (i % 5) - 2),
      ...new Array(10).fill(0).map((_, i) => (i % 5) - 2),
    ];
    const y = [
      ...new Array(40).fill(0).map((_, i) => (i % 3) - 1),
      ...new Array(10).fill(0).map((_, i) => 30 + ((i % 3) - 1)),
    ];

    const scores = scoreCategories(cats, [x, y], allVisible(cats.length));

    expect(scoreOf(scores, "tall")).toBeGreaterThan(5);
  });

  it("ignores points that aren't drawn", () => {
    // Hidden by a filter, or null on an axis — either way the plot won't show
    // them, so ranking on them would rank a picture nobody is looking at.
    const cats = ["a", "a", "a", "a", "b", "b", "b", "b"];
    const x = [1, 2, 3, null, 1, 2, 3, 4];
    const visible = [true, true, true, true, true, true, true, false];

    const scores = scoreCategories(cats, [x], visible);

    expect(scores.find((s) => s.category === "a")!.count).toBe(3);
    expect(scores.find((s) => s.category === "b")!.count).toBe(3);
  });

  it("falls back to group size when there is no axis to separate on", () => {
    // A correlation heatmap has no per-point position. Size is the only signal
    // left, and it at least stays explicable.
    const cats = [...new Array(7).fill("big"), ...new Array(2).fill("small")];

    const scores = scoreCategories(cats, [], allVisible(cats.length));

    expect(scoreOf(scores, "big")).toBe(7);
    expect(scoreOf(scores, "small")).toBe(2);
  });

  it("does not fall over on a constant axis", () => {
    const cats = ["a", "a", "a", "b", "b", "b"];
    const x = [5, 5, 5, 5, 5, 5];

    const scores = scoreCategories(cats, [x], allVisible(cats.length));

    expect(scoreOf(scores, "a")).toBe(0);
    expect(scoreOf(scores, "b")).toBe(0);
  });

  it("treats perfect separation as the strongest signal, not the weakest", () => {
    // Neither group varies internally, so the pooled variance is zero — but
    // they do not overlap at all. Scoring that as "no evidence" would be
    // exactly backwards, and a binary axis reaches it.
    const cats = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
    const x = [0, 0, 0, 1, 1, 1, 0, 0, 0];

    const scores = scoreCategories(cats, [x], allVisible(cats.length));

    expect(scoreOf(scores, "b")).toBe(Infinity);
  });
});

describe("selectBestCategories", () => {
  const scores = [
    { category: "delta", count: 10, means: [0], score: 9 },
    { category: "alpha", count: 10, means: [0], score: 3 },
    { category: "charlie", count: 10, means: [0], score: 7 },
    { category: "bravo", count: 10, means: [0], score: 1 },
  ];

  it("keeps everything when it all fits", () => {
    expect(selectBestCategories(scores, 4, compareLabels)).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta",
    ]);
  });

  it("keeps the highest scoring, and returns them alphabetically", () => {
    // Ranking decides which categories, not their order — color assignment
    // stays alphabetical so that changing an axis doesn't reshuffle the legend
    // as well as re-deciding it.
    expect(selectBestCategories(scores, 2, compareLabels)).toEqual([
      "charlie",
      "delta",
    ]);
  });

  it("breaks ties by size", () => {
    // Everything too small to score lands at zero together, so the tiebreak is
    // load-bearing rather than decorative.
    const tied = [
      { category: "small", count: 3, means: [0], score: 0 },
      { category: "large", count: 300, means: [0], score: 0 },
    ];

    expect(selectBestCategories(tied, 1, compareLabels)).toEqual(["large"]);
  });
});
