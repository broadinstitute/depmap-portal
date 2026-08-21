import { breadboxAPI } from "@depmap/api";
import { fetchExpandedPlot } from "../expandedPlot";

// Scenario under test: a Transcript-Explorer-shaped plot. The x axis is the
// expansion (transcripts of one gene, carrying the "expansion" sentinel), and
// the y axis is an ordinary aggregated slice that happens to ALSO be
// transcript-typed — e.g. "mean expression over transcripts of CD44" read from
// a different transcript dataset. Changing y's `aggregation` must change the
// values y contributes to the plot.

const modelIdentifiers = [
  { id: "ACH-000425", label: "NIHOVCAR3" },
  { id: "ACH-000552", label: "HT29" },
];

const transcriptIdentifiers = [
  { id: "ENST0001", label: "CD44-201" },
  { id: "ENST0002", label: "CD44-202" },
];

const dimensionTypes = [
  {
    name: "depmap_model",
    display_name: "Cell Line",
    id_column: "depmap_id",
    axis: "sample" as const,
    metadata_dataset_id: "depmap_model_metadata",
  },
  {
    name: "transcript",
    display_name: "Transcript",
    id_column: "transcript_id",
    axis: "feature" as const,
    metadata_dataset_id: "transcript_metadata",
  },
  // Present only so the same-axis guard has a second feature type to reject
  // "transcript" against. No dataset here is indexed by it.
  {
    name: "gene",
    display_name: "Gene",
    id_column: "entrez_id",
    axis: "feature" as const,
    metadata_dataset_id: "gene_metadata",
  },
];

const shortReadDataset = {
  id: "short_read",
  given_id: "short_read",
  name: "Expression (short read)",
  format: "matrix_dataset" as const,
  feature_type_name: "transcript",
  sample_type_name: "depmap_model",
  units: "log2(TPM+1)",
  value_type: "continuous" as const,
  data_type: "Expression",
  priority: 1,
};

const longReadDataset = {
  ...shortReadDataset,
  id: "long_read",
  given_id: "long_read",
  name: "Expression (long read)",
};

const transcriptContext = {
  name: "CD44",
  dimension_type: "transcript",
  expr: { "==": [{ var: "gene" }, "CD44"] },
  vars: {
    gene: {
      dataset_id: "transcript_metadata",
      identifier: "Gene",
      identifier_type: "column" as const,
      source: "property" as const,
    },
  },
};

function makeConfig(aggregation: string) {
  return {
    index_type: "depmap_model",
    plot_type: "scatter",
    dimensions: {
      // The expansion axis: carries the "expansion" sentinel.
      x: {
        axis_type: "aggregated_slice",
        slice_type: "transcript",
        dataset_id: "short_read",
        context: transcriptContext,
        aggregation: "expansion",
      },
      // A plain aggregated slice that is also transcript-typed.
      y: {
        axis_type: "aggregated_slice",
        slice_type: "transcript",
        dataset_id: "long_read",
        context: transcriptContext,
        aggregation,
      },
    },
    expand_by: [
      {
        slice_type: "transcript",
        context: transcriptContext,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Every getMatrixDatasetData call, so we can inspect how y was fetched.
let matrixCalls: { datasetId: string; args: Record<string, unknown> }[] = [];

beforeEach(() => {
  matrixCalls = [];

  breadboxAPI.getDimensionTypes = jest
    .fn<ReturnType<typeof breadboxAPI.getDimensionTypes>, []>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(dimensionTypes as any);

  breadboxAPI.getDatasets = jest
    .fn<ReturnType<typeof breadboxAPI.getDatasets>, []>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue([shortReadDataset, longReadDataset] as any);

  breadboxAPI.getDataset = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation(
      (datasetId: string) =>
        Promise.resolve(
          datasetId === "long_read" ? longReadDataset : shortReadDataset
        )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

  breadboxAPI.getDatasetSamples = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(modelIdentifiers as any);

  breadboxAPI.getDatasetFeatures = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(transcriptIdentifiers as any);

  breadboxAPI.evaluateContext = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [any]>()
    .mockResolvedValue({
      ids: transcriptIdentifiers.map((t) => t.id),
      labels: transcriptIdentifiers.map((t) => t.label),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

  breadboxAPI.getDimensionTypeIdentifiers = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(transcriptIdentifiers as any);

  breadboxAPI.getTabularDatasetData = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string, any]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation((_datasetId: string, args: any) => {
      const column = args?.identifier ?? args?.columns?.[0] ?? "label";

      return Promise.resolve({
        [column]: {
          "ACH-000425": "Ovary/Fallopian Tube",
          "ACH-000552": "Bowel",
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  breadboxAPI.getMatrixDatasetData = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string, any]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation((datasetId: string, args: any) => {
      matrixCalls.push({ datasetId, args });

      // Aggregated request: response is keyed by the aggregation name. The
      // values differ per aggregation (mean of 10,30 vs sum of 10,30) so a
      // test can tell whether the requested aggregation reached the response.
      if (args.aggregate) {
        const isSum = args.aggregate.aggregation === "sum";

        return Promise.resolve({
          [args.aggregate.aggregation]: {
            "ACH-000425": isSum ? 40 : 20,
            "ACH-000552": isSum ? 60 : 30,
          },
        });
      }

      // Un-aggregated matrix: Record<feature_id, Record<sample_id, value>>.
      return Promise.resolve({
        ENST0001: { "ACH-000425": 10, "ACH-000552": 20 },
        ENST0002: { "ACH-000425": 30, "ACH-000552": 40 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
});

test("a non-expansion aggregated slice sharing the expansion's slice_type is aggregated", async () => {
  await fetchExpandedPlot(makeConfig("mean"));

  const yCall = matrixCalls.find((c) => c.datasetId === "long_read");

  expect(yCall).toBeDefined();
  expect(yCall!.args.aggregate).toEqual({
    aggregate_by: "features",
    aggregation: "mean",
  });
});

test("the sentinel-bearing axis is still materialized per-pair, not aggregated", async () => {
  const response = await fetchExpandedPlot(makeConfig("mean"));

  const xCall = matrixCalls.find((c) => c.datasetId === "short_read");

  expect(xCall).toBeDefined();
  expect(xCall!.args.aggregate).toBeUndefined();
  // Two models × two transcripts, index-major.
  expect(response.dimensions.x!.values).toEqual([10, 30, 20, 40]);
});

test("an `expand_by` with no sentinel-bearing axis is rejected", async () => {
  const config = makeConfig("mean");
  config.dimensions.x.aggregation = "mean";

  await expect(fetchExpandedPlot(config)).rejects.toThrow(
    /no dimension carries the "expansion" sentinel/
  );
});

test("an index and an expansion on the same axis are rejected", async () => {
  // A shared link is fed straight to useReducer as initial state, so normalize()
  // never runs on it -- and normalize wouldn't catch this anyway, since it only
  // compares slice_type to slice_type. Both "gene" and "transcript" are feature
  // types, so there is no cell to read for such a pair. Left unchecked the
  // index ids go into the slot meant for the other axis, match nothing, and the
  // plot comes back empty with nothing to say why.
  const config = makeConfig("mean");
  config.index_type = "gene";

  await expect(fetchExpandedPlot(config)).rejects.toThrow(
    /both are feature types/
  );
});

test("both axes can expand over the same members, each from its own dataset", async () => {
  // The short-read vs long-read comparison: y joins x's expansion instead of
  // aggregating it, so each point is one (model, transcript) pair with the two
  // assays' values on the two axes.
  const config = makeConfig("mean");
  config.dimensions.y.aggregation = "expansion";

  const response = await fetchExpandedPlot(config);

  // Neither axis is aggregated — both are read cell by cell.
  expect(matrixCalls.every((c) => c.args.aggregate === undefined)).toBe(true);
  expect(matrixCalls.map((c) => c.datasetId).sort()).toEqual([
    "long_read",
    "short_read",
  ]);

  // Two models × two transcripts, index-major, and the two axes are parallel
  // — index_ids[i] and expansions[0].ids[i] describe the same point on both.
  expect(response.dimensions.x!.values).toEqual([10, 30, 20, 40]);
  expect(response.dimensions.y!.values).toEqual([10, 30, 20, 40]);
  expect(response.index_ids).toEqual([
    "ACH-000425",
    "ACH-000425",
    "ACH-000552",
    "ACH-000552",
  ]);
  expect(response.expansions[0].ids).toEqual([
    "ENST0001",
    "ENST0002",
    "ENST0001",
    "ENST0002",
  ]);
});

// Replaces the shared matrix mock with one that reports per-member statistics
// per dataset, so a member can be tracked by one expanding axis and not the
// other. `trackedBy` names which transcripts each dataset has counts for; a
// member missing from a dataset's list comes back with no entry at all, which
// is what a dataset that doesn't measure it actually returns.
function mockMemberStats(trackedBy: Record<string, string[]>) {
  const previous = breadboxAPI.getMatrixDatasetData;

  breadboxAPI.getMatrixDatasetData = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string, any]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation((datasetId: string, args: any) => {
      // The member-statistics request asks for several aggregations at once;
      // every other aggregated call names exactly one.
      if (Array.isArray(args?.aggregate?.aggregation)) {
        matrixCalls.push({ datasetId, args });

        const tracked = trackedBy[datasetId] ?? [];
        const forEachTracked = (value: number) =>
          Object.fromEntries(tracked.map((id) => [id, value]));

        return Promise.resolve({
          variance: forEachTracked(1),
          stddev: forEachTracked(1),
          mean: forEachTracked(1),
          count: forEachTracked(2),
        });
      }

      return previous(datasetId, args);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
}

// A hand-picked member set is the cheapest way to get here: it never ranks, so
// nothing else has already counted the members, and picking fewer than all of
// them is what makes availability worth reporting in the first place.
function makeTwoExpansionsConfig(yDatasetId: string) {
  const config = makeConfig("mean");
  config.dimensions.y.aggregation = "expansion";
  config.dimensions.y.dataset_id = yDatasetId;
  config.expand_by[0].members = ["ENST0001"];

  return config;
}

const memberStatsCalls = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrixCalls.filter((c) =>
    Array.isArray((c.args.aggregate as any)?.aggregation)
  );

test("availability counts only members every expanding axis measures", async () => {
  // Short read tracks both transcripts, long read only the first. A point needs
  // a value on both axes, so ENST0002 can never be drawn however it is picked.
  // Counting availability from the ranking dataset alone reported 2 here, which
  // kept "shown < available" true and left the member control offering a
  // transcript no selection could reach.
  mockMemberStats({
    short_read: ["ENST0001", "ENST0002"],
    long_read: ["ENST0001"],
  });

  const response = await fetchExpandedPlot(
    makeTwoExpansionsConfig("long_read")
  );

  expect(response.expansions[0].available_count).toBe(1);
  // And so the control hides rather than offering the unreachable one: its rule
  // is shown >= available.
  expect(response.expansions[0].shown_count).toBe(1);
});

test("availability still spans the whole ranking dataset when only x expands", async () => {
  // The same fixture with y aggregating instead of expanding. Nothing narrows
  // the members, so both remain available and the control keeps offering the
  // second — the case the change above must not disturb.
  mockMemberStats({
    short_read: ["ENST0001", "ENST0002"],
    long_read: ["ENST0001"],
  });

  const config = makeConfig("mean");
  config.expand_by[0].members = ["ENST0001"];

  const response = await fetchExpandedPlot(config);

  expect(response.expansions[0].available_count).toBe(2);
  expect(response.expansions[0].shown_count).toBe(1);
});

test("two axes sharing a dataset ask for member statistics once", async () => {
  mockMemberStats({ short_read: ["ENST0001", "ENST0002"] });

  const response = await fetchExpandedPlot(
    makeTwoExpansionsConfig("short_read")
  );

  expect(memberStatsCalls()).toHaveLength(1);
  expect(response.expansions[0].available_count).toBe(2);
});

test("a dataset reporting no statistics leaves availability unknown", async () => {
  // Long read answers with nothing at all — an aggregation that didn't apply,
  // not a dataset measuring none of them. Intersecting with that empty result
  // would claim nothing is available while a point is plainly on screen.
  mockMemberStats({
    short_read: ["ENST0001", "ENST0002"],
    long_read: [],
  });

  const response = await fetchExpandedPlot(
    makeTwoExpansionsConfig("long_read")
  );

  expect(response.expansions[0].available_count).toBeUndefined();
  expect(response.expansions[0].shown_count).toBe(1);
});

test("rejects a sentinel on a dimension that isn't an axis", async () => {
  // Only reachable from a caller that bypassed the reducer, which repairs this
  // — but the message has to name the real problem rather than leaving the
  // reader chasing a mis-routing bug that isn't there.
  const config = makeConfig("mean");
  config.dimensions.color = {
    axis_type: "aggregated_slice",
    slice_type: "transcript",
    dataset_id: "long_read",
    context: transcriptContext,
    aggregation: "expansion",
  };

  await expect(fetchExpandedPlot(config)).rejects.toThrow(
    /Only the x and y axes can expand/
  );
});

test("changing that slice's aggregation changes the values it contributes", async () => {
  const withMean = await fetchExpandedPlot(makeConfig("mean"));
  const withSum = await fetchExpandedPlot(makeConfig("sum"));

  const requested = matrixCalls
    .filter((c) => c.datasetId === "long_read")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c) => (c.args.aggregate as any)?.aggregation);

  expect(requested).toEqual(["mean", "sum"]);
  expect(withSum.dimensions.y!.values).not.toEqual(
    withMean.dimensions.y!.values
  );
});
