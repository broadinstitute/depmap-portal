import { compareByPriorityAboveCoverageFloor } from "../useDimensionStateManager/computeOptions";

type Dataset = { id: string; priority?: number | null };

const order = (
  datasets: Dataset[],
  counts: Record<string, number> | null,
  total: number | null
) =>
  [...datasets]
    .sort(
      compareByPriorityAboveCoverageFloor(
        (d: Dataset) => (counts ? counts[d.id] ?? 0 : 0),
        total
      )
    )
    .map((d) => d.id);

const datasets: Dataset[] = [
  { id: "repurposing", priority: 1 },
  { id: "gdsc2", priority: 4 },
  { id: "oncref", priority: 6 },
];

describe("compareByPriorityAboveCoverageFloor", () => {
  it("lets priority decide among versions that clear the floor", () => {
    // The complaint this replaced coverage-first ordering to fix. All three hold
    // enough of the context to answer the question, so the curated order stands
    // even though Repurposing holds far less of it than GDSC2.
    expect(
      order(datasets, { repurposing: 5, gdsc2: 380, oncref: 42 }, 400)
    ).toEqual(["repurposing", "gdsc2", "oncref"]);
  });

  it("sinks a version below the floor beneath one above it, whatever its priority", () => {
    const below: Dataset[] = [
      { id: "best-priority", priority: 1 },
      { id: "worst-priority", priority: 9 },
    ];

    expect(
      order(below, { "best-priority": 2, "worst-priority": 3 }, 400)
    ).toEqual(["worst-priority", "best-priority"]);
  });

  it("ranks versions that are all below the floor by coverage", () => {
    // Nothing here can really answer the question, so offer the least bad one.
    // `oncref` is absent from counts, which is how the endpoint reports zero.
    expect(order(datasets, { repurposing: 1, gdsc2: 2 }, 400)).toEqual([
      "gdsc2",
      "repurposing",
      "oncref",
    ]);
  });

  it("falls back to priority when coverage ties below the floor", () => {
    expect(
      order(datasets, { repurposing: 2, gdsc2: 2, oncref: 2 }, 400)
    ).toEqual(["repurposing", "gdsc2", "oncref"]);
  });

  it("clamps the floor to a context smaller than it", () => {
    // A two-entity context can never reach a floor of three. Left unclamped
    // every version would sit below the floor and coverage would decide, which
    // is the ordering this comparator exists to move away from. Both versions
    // hold the whole context, so priority decides.
    expect(order(datasets, { repurposing: 2, gdsc2: 2 }, 2)).toEqual([
      "repurposing",
      "gdsc2",
      "oncref",
    ]);
  });

  it("clamps to one for a single-entity context", () => {
    // Selecting one gene is the most common case of all: holding it clears the
    // floor, and priority orders the versions that do.
    expect(order(datasets, { gdsc2: 1, oncref: 1 }, 1)).toEqual([
      "gdsc2",
      "oncref",
      "repurposing",
    ]);
  });

  it("is the plain priority order when there is no coverage to go on", () => {
    // No context selected, or the coverage request failed. Must reduce exactly
    // to the behavior that predates this, rather than to an arbitrary one.
    expect(order(datasets, null, null)).toEqual([
      "repurposing",
      "gdsc2",
      "oncref",
    ]);
  });

  it("puts a dataset with no priority last", () => {
    const withMissing: Dataset[] = [
      { id: "unset" },
      { id: "low", priority: 1 },
      { id: "high", priority: 9 },
    ];

    // A missing priority is an absence of curation, not the strongest possible
    // claim. With no context the coverage tiebreak is inert, so this isolates
    // the priority ordering.
    expect(order(withMissing, null, null)).toEqual(["low", "high", "unset"]);
  });

  it("ranks by coverage when nothing has a priority", () => {
    // The case a pairwise comparator looks unable to handle, since "no dataset
    // anywhere has a priority" is a statement about the whole list. It needs no
    // special handling: every pair ties on priority, so the coverage tiebreak
    // decides all of them. Without that tiebreak this would keep whatever order
    // the dataset request returned and ignore coverage entirely.
    const unprioritized: Dataset[] = [
      { id: "few" },
      { id: "most" },
      { id: "some" },
    ];

    expect(
      order(unprioritized, { few: 5, most: 300, some: 100 }, 400)
    ).toEqual(["most", "some", "few"]);
  });

  it("breaks a shared priority by coverage", () => {
    const tied: Dataset[] = [
      { id: "lesser", priority: 4 },
      { id: "greater", priority: 4 },
    ];

    expect(order(tied, { lesser: 40, greater: 300 }, 400)).toEqual([
      "greater",
      "lesser",
    ]);
  });

  it("treats two missing priorities as equal rather than NaN", () => {
    // Subtracting the sentinels would give Infinity - Infinity here. The sort
    // reads a NaN as "equal", which is the intent by luck rather than design,
    // so the comparator compares them instead. Pinned to keep it that way.
    const compare = compareByPriorityAboveCoverageFloor<Dataset>(() => 10, 400);

    expect(compare({ id: "a" }, { id: "b" })).toBe(0);
  });
});
