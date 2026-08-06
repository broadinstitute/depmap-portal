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
        limit: 9,
        offset: 0,
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
