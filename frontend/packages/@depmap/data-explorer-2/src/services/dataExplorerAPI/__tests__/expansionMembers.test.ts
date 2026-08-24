import { breadboxAPI } from "@depmap/api";
import {
  assertExpansionAxesDiffer,
  chooseExpansionMembers,
  expansionCapForIndexSize,
  MAX_EXPANSION_MEMBERS,
  maxExpansionMembersFor,
  varianceLowerBound,
  selectBestMembers,
} from "../expansionMembers";

// Enough coverage to clear any floor these tests produce.
const wellCovered = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, 500]));

describe("varianceLowerBound", () => {
  it("barely discounts a well-measured member", () => {
    // 725 cell lines pins the variance down; the bound sits just under it.
    const bound = varianceLowerBound(1, 725) as number;

    expect(bound).toBeGreaterThan(0.9);
    expect(bound).toBeLessThan(1);
  });

  it("discounts a small sample in proportion to what it leaves open", () => {
    // The case the old floor got wrong. 29 observations is a real measurement,
    // not noise — it should be marked down, not struck out.
    const bound = varianceLowerBound(1, 29) as number;

    expect(bound).toBeCloseTo(0.677, 2);
  });

  it("marks a two-point spread down to a quarter of itself", () => {
    // What the floor existed to stop, now handled by the same rule as
    // everything else rather than by a threshold.
    expect(varianceLowerBound(1, 2) as number).toBeCloseTo(0.267, 2);
  });

  it("is monotonic in the sample size", () => {
    // The property that lets the column showing this also explain the
    // selection: more observations of the same spread can only rank higher.
    const bounds = [2, 5, 10, 30, 100, 500].map(
      (n) => varianceLowerBound(1, n) as number
    );

    bounds.forEach((bound, i) => {
      if (i > 0) {
        expect(bound).toBeGreaterThan(bounds[i - 1]);
      }
    });
  });

  it("has nothing to bound below two observations", () => {
    expect(varianceLowerBound(1, 1)).toBeNull();
    expect(varianceLowerBound(1, 0)).toBeNull();
    expect(varianceLowerBound(null, 100)).toBeNull();
    expect(varianceLowerBound(undefined, 100)).toBeNull();
    expect(varianceLowerBound(NaN, 100)).toBeNull();
  });
});

describe("selectBestMembers", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("keeps everything when there is nothing to choose between", () => {
    expect(selectBestMembers(ids, {}, {}, 5)).toEqual(ids);
    expect(selectBestMembers(ids, {}, {}, 9)).toEqual(ids);
  });

  it("keeps the members that vary most", () => {
    const variance = { a: 1, b: 50, c: 2, d: 40, e: 3 };

    expect(selectBestMembers(ids, variance, wellCovered(ids), 2)).toEqual([
      "b",
      "d",
    ]);
  });

  it("returns survivors in candidate order, not variance order", () => {
    // d is the most variable, but b comes first in the context.
    const variance = { a: 1, b: 50, c: 2, d: 99, e: 3 };

    expect(selectBestMembers(ids, variance, wellCovered(ids), 2)).toEqual([
      "b",
      "d",
    ]);
  });

  it("discounts a spread measured over very few entities", () => {
    // "a" posts by far the highest raw variance, on three observations out of
    // five hundred — exactly the outlier-driven noise this has to reject. The
    // bound drops it to a third of itself, which is still not enough to lose,
    // so this also pins that the discount is a discount and not a veto.
    const variance = { a: 999, b: 50, c: 2, d: 40, e: 3 };
    const count = { a: 3, b: 500, c: 500, d: 500, e: 500 };

    expect(selectBestMembers(ids, variance, count, 2)).toEqual(["a", "b"]);

    // Bring it within range of its neighbours and the discount decides it.
    const closer = { a: 60, b: 50, c: 2, d: 40, e: 3 };

    expect(selectBestMembers(ids, closer, count, 2)).toEqual(["b", "d"]);
  });

  it("no longer strikes out a well-measured member from a smaller screen", () => {
    // The reported case, in miniature. Under the old floor — 10% of the index,
    // capped at 30 — every member with 29 observations was removed before its
    // variance was consulted, however large that variance was. Nothing is
    // removed now.
    const variance = { a: 5, b: 1, c: 1, d: 1, e: 1 };
    const count = { a: 29, b: 500, c: 500, d: 500, e: 500 };

    expect(selectBestMembers(ids, variance, count, 2)).toContain("a");
  });

  it("still ranks something when every member is sparse", () => {
    const variance = { a: 1, b: 50, c: 2, d: 40, e: 3 };
    const count = { a: 1, b: 2, c: 1, d: 2, e: 1 };

    expect(selectBestMembers(ids, variance, count, 2)).toEqual(["b", "d"]);
  });

  it("sorts members with no computable variance last", () => {
    // null (all-null) and undefined (absent from the response) both mean "no
    // spread to speak of", but still beat showing nothing.
    const variance = { a: null, b: 1, c: undefined, d: 2 };
    const candidates = ["a", "b", "c", "d"];

    expect(
      selectBestMembers(candidates, variance, wellCovered(candidates), 2)
    ).toEqual(["b", "d"]);

    expect(
      selectBestMembers(candidates, variance, wellCovered(candidates), 3)
    ).toEqual(["a", "b", "d"]);
  });
});

describe("chooseExpansionMembers", () => {
  const transcripts = Array.from({ length: 20 }, (_, i) => `ENST${i}`);

  const baseArgs = {
    candidateIds: transcripts,
    cap: 3,
    index_type: "depmap_model",
    dataset_id: "short_read",
    slice_type: "transcript",
    visibleFilter: undefined,
    isContinuous: true,
  };

  beforeEach(() => {
    breadboxAPI.getDimensionTypes = jest
      .fn<ReturnType<typeof breadboxAPI.getDimensionTypes>, []>()
      .mockResolvedValue([
        {
          name: "depmap_model",
          display_name: "Cell Line",
          id_column: "depmap_id",
          axis: "sample",
        },
        {
          name: "transcript",
          display_name: "Transcript",
          id_column: "transcript_id",
          axis: "feature",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any);

    breadboxAPI.getDatasetSamples = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<any, [string]>()
      .mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [
          { id: "ACH-1", label: "M1" },
          { id: "ACH-2", label: "M2" },
        ] as any
      );

    breadboxAPI.getMatrixDatasetData = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<any, [string, any]>()
      .mockResolvedValue({
        variance: Object.fromEntries(transcripts.map((id, i) => [id, i])),
        count: Object.fromEntries(transcripts.map((id) => [id, 500])),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
  });

  it("does not fetch anything when every candidate fits", async () => {
    const result = await chooseExpansionMembers({
      ...baseArgs,
      candidateIds: ["a", "b"],
      cap: 9,
    });

    expect(result).toEqual(["a", "b"]);
    expect(breadboxAPI.getMatrixDatasetData).not.toHaveBeenCalled();
  });

  it("collapses the INDEX axis, not the slice axis", async () => {
    // The inverse of every other aggregation call in this package, and the
    // easiest thing to get backwards. Transcripts are features here, so the
    // samples are what collapse — leaving one scalar per transcript.
    await chooseExpansionMembers(baseArgs);

    const [
      datasetId,
      args,
    ] = (breadboxAPI.getMatrixDatasetData as jest.Mock).mock.calls[0];

    expect(datasetId).toBe("short_read");
    expect(args.aggregate).toEqual({
      aggregate_by: "samples",
      // stddev and mean ride along for the member table. They cost nothing
      // extra — the expense is reading the block out of HDF5 — and asking for
      // them here means the table and the ranking share one cached request.
      aggregation: ["variance", "stddev", "mean", "count"],
    });
    expect(args.features).toEqual(transcripts);
    expect(args.samples).toEqual(["ACH-1", "ACH-2"]);
  });

  it("keeps the highest-variance members", async () => {
    const result = await chooseExpansionMembers(baseArgs);

    // Variance was seeded as the index, so the last three win — and come back
    // in context order.
    expect(result).toEqual(["ENST17", "ENST18", "ENST19"]);
  });

  it("ranks over only the visible entities when a filter is set", async () => {
    breadboxAPI.evaluateContext = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<any, [any]>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue({ ids: ["ACH-2"], labels: ["M2"] } as any);

    await chooseExpansionMembers({
      ...baseArgs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visibleFilter: { name: "Bowel" } as any,
    });

    const [
      ,
      args,
    ] = (breadboxAPI.getMatrixDatasetData as jest.Mock).mock.calls[0];

    expect(args.samples).toEqual(["ACH-2"]);
  });

  it("honors hand-picked members without ranking anything", async () => {
    const result = await chooseExpansionMembers({
      ...baseArgs,
      pinnedIds: ["ENST9", "ENST2"],
    });

    // Candidate order, not the order they were pinned in — the plot draws them
    // in context order either way, so reporting them that way keeps the two
    // from disagreeing.
    expect(result).toEqual(["ENST2", "ENST9"]);
    expect(breadboxAPI.getMatrixDatasetData).not.toHaveBeenCalled();
  });

  it("still caps a hand-picked selection", async () => {
    const result = await chooseExpansionMembers({
      ...baseArgs,
      cap: 2,
      pinnedIds: ["ENST1", "ENST2", "ENST3", "ENST4"],
    });

    expect(result).toEqual(["ENST1", "ENST2"]);
  });

  it("ranks instead when the pinned members are all stale", async () => {
    // What a link written against a different gene looks like. Honoring these
    // would ask the expansion for entities it does not contain.
    const result = await chooseExpansionMembers({
      ...baseArgs,
      pinnedIds: ["ENSTfromSomeOtherGene"],
    });

    expect(result).toEqual(["ENST17", "ENST18", "ENST19"]);
    expect(breadboxAPI.getMatrixDatasetData).toHaveBeenCalled();
  });

  it("falls back to context order for a categorical dataset", async () => {
    // Breadbox can only aggregate continuous matrices, so there is no spread
    // to rank by.
    const result = await chooseExpansionMembers({
      ...baseArgs,
      isContinuous: false,
    });

    expect(result).toEqual(["ENST0", "ENST1", "ENST2"]);
    expect(breadboxAPI.getMatrixDatasetData).not.toHaveBeenCalled();
  });
});

describe("assertExpansionAxesDiffer", () => {
  beforeEach(() => {
    breadboxAPI.getDimensionTypes = jest
      .fn<ReturnType<typeof breadboxAPI.getDimensionTypes>, []>()
      .mockResolvedValue([
        { name: "gene", axis: "feature" },
        { name: "transcript", axis: "feature" },
        { name: "depmap_model", axis: "sample" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any);
  });

  it("accepts an index and members on opposite axes", async () => {
    await expect(
      assertExpansionAxesDiffer("depmap_model", "transcript")
    ).resolves.toBeUndefined();
  });

  it("rejects an index and members on the same axis", async () => {
    // The state a shared link can reach: nothing downstream checks it, and
    // unchecked it doesn't fail, it returns an empty plot. Both type names and
    // the shared axis belong in the message, since the whole point is that the
    // reader can't see the problem from the config.
    await expect(
      assertExpansionAxesDiffer("gene", "transcript")
    ).rejects.toThrow(/"gene".*"transcript".*both are feature types/s);
  });

  it("says nothing about axes it cannot determine", async () => {
    // Callers already tolerate an unrecognized type (they read id_column off
    // it optionally). Don't turn that into a confident claim about axes.
    await expect(
      assertExpansionAxesDiffer("gene", "not_a_real_type")
    ).resolves.toBeUndefined();
  });
});

describe("expansionCapForIndexSize", () => {
  // These two are the entire empirical basis for CAP_SCALE — the points at
  // which each configuration stopped feeling responsive in practice. Everything
  // else about the curve is interpolation, so a regression in either of these
  // is a regression in the only thing that was actually measured.
  it("reproduces the measured limits", () => {
    // depmap_model × expression: 2,446 cell lines.
    expect(expansionCapForIndexSize(2446)).toBe(9);
    // gene × expression: 19,215 genes. A 7.9x index, but only a third of the
    // cap -- which is the whole reason this isn't a linear scale.
    expect(expansionCapForIndexSize(19215)).toBe(3);
  });

  it("clamps at both ends", () => {
    // A small index could afford dozens of panels; it still doesn't get them,
    // because past 16 nobody can read them.
    expect(expansionCapForIndexSize(100)).toBe(MAX_EXPANSION_MEMBERS);
    expect(expansionCapForIndexSize(1)).toBe(MAX_EXPANSION_MEMBERS);

    // And a very large one still gets a real expansion rather than 1 (a single
    // slice wearing an expansion's config) or 0.
    expect(expansionCapForIndexSize(100000)).toBe(2);
    expect(expansionCapForIndexSize(10 ** 9)).toBe(2);
  });

  it("never rewards a bigger index with a bigger cap", () => {
    let previous = Infinity;

    for (let n = 1; n <= 100000; n = Math.ceil(n * 1.3)) {
      const cap = expansionCapForIndexSize(n);
      expect(cap).toBeLessThanOrEqual(previous);
      previous = cap;
    }
  });

  it("survives a degenerate index size", () => {
    // An empty or unknown dataset shouldn't produce NaN and poison the slice.
    expect(expansionCapForIndexSize(0)).toBe(MAX_EXPANSION_MEMBERS);
    expect(expansionCapForIndexSize(NaN)).toBe(MAX_EXPANSION_MEMBERS);
  });
});

describe("maxExpansionMembersFor", () => {
  const dimensionTypes = [
    {
      name: "gene",
      display_name: "Gene",
      id_column: "entrez_id",
      axis: "feature",
    },
    {
      name: "depmap_model",
      display_name: "Cell Line",
      id_column: "depmap_id",
      axis: "sample",
    },
  ];

  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, label: `L${i}` }));

  beforeEach(() => {
    breadboxAPI.getDimensionTypes = jest
      .fn<ReturnType<typeof breadboxAPI.getDimensionTypes>, []>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue(dimensionTypes as any);

    breadboxAPI.getDatasetFeatures = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<any, [string]>()
      .mockResolvedValue(rows(19215));

    breadboxAPI.getDatasetSamples = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<any, [string]>()
      .mockResolvedValue(rows(2446));
  });

  // The axis this reads is the easiest thing in the package to get backwards --
  // fetchExpansionMemberStats deliberately inverts the *other* axis two
  // functions away, complete with a "do not fix this to match" comment. So the
  // dispatch is asserted directly, not just implied by the resulting number.
  it("measures a feature-typed index on the feature axis", async () => {
    expect(await maxExpansionMembersFor("gene", "expression")).toBe(3);

    expect(breadboxAPI.getDatasetFeatures).toHaveBeenCalledWith("expression");
    expect(breadboxAPI.getDatasetSamples).not.toHaveBeenCalled();
  });

  it("measures a sample-typed index on the sample axis", async () => {
    expect(await maxExpansionMembersFor("depmap_model", "expression")).toBe(9);

    expect(breadboxAPI.getDatasetSamples).toHaveBeenCalledWith("expression");
    expect(breadboxAPI.getDatasetFeatures).not.toHaveBeenCalled();
  });

  it("scales with the index, not with the dataset's identity", async () => {
    // Same dataset id, same index type, fewer entities: a bigger cap. The cap
    // is a property of the index being multiplied and nothing else -- which is
    // exactly what the old slice_type-keyed table got wrong.
    breadboxAPI.getDatasetSamples = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<any, [string]>()
      .mockResolvedValue(rows(500));

    expect(await maxExpansionMembersFor("depmap_model", "expression")).toBe(
      MAX_EXPANSION_MEMBERS
    );
  });
});
