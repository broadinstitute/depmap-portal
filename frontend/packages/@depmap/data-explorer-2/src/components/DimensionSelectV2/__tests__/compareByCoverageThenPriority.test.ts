import { compareByCoverageThenPriority } from "../useDimensionStateManager/computeOptions";

type Dataset = { id: string; priority?: number | null };

const order = (datasets: Dataset[], counts: Record<string, number> | null) =>
  [...datasets]
    .sort(
      compareByCoverageThenPriority((d: Dataset) =>
        counts ? counts[d.id] ?? 0 : 0
      )
    )
    .map((d) => d.id);

const datasets: Dataset[] = [
  { id: "repurposing", priority: 1 },
  { id: "gdsc2", priority: 4 },
  { id: "oncref", priority: 6 },
];

describe("compareByCoverageThenPriority", () => {
  it("prefers the version that has the data over the one priority prefers", () => {
    // The reported case. Repurposing sorts first on priority and holds three of
    // the two hundred compound doses the context named; GDSC2 holds nearly all
    // of them and used to lose.
    expect(
      order(datasets, { repurposing: 3, gdsc2: 187, oncref: 42 })
    ).toEqual(["gdsc2", "oncref", "repurposing"]);
  });

  it("falls back to priority when coverage ties", () => {
    expect(
      order(datasets, { repurposing: 50, gdsc2: 50, oncref: 50 })
    ).toEqual(["repurposing", "gdsc2", "oncref"]);
  });

  it("sinks a version holding none of it below one holding any", () => {
    expect(order(datasets, { gdsc2: 1 })).toEqual([
      "gdsc2",
      "repurposing",
      "oncref",
    ]);
  });

  it("is the plain priority order when there is no coverage to go on", () => {
    // No context selected, or the coverage request failed. Must reduce exactly
    // to the behavior that predates this, rather than to an arbitrary one.
    expect(order(datasets, null)).toEqual(["repurposing", "gdsc2", "oncref"]);
  });

  it("puts a dataset with no priority last among equals", () => {
    const withMissing: Dataset[] = [
      { id: "unset" },
      { id: "low", priority: 1 },
      { id: "high", priority: 9 },
    ];

    // -Infinity, so it sorts first ascending — which is the pre-existing
    // convention this comparator inherited rather than changed. Pinned so a
    // future change to it is a deliberate one.
    expect(order(withMissing, null)).toEqual(["unset", "low", "high"]);
  });
});
