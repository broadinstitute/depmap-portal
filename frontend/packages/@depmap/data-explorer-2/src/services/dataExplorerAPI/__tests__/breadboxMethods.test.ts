import { breadboxAPI } from "@depmap/api";
import {
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  buildExtendedMetadata,
  fetchCorrelation,
  fetchPlotDimensions,
} from "../breadboxMethods";

// Fixtures shared across cases.

const modelIdentifiers = [
  { id: "ACH-000425", label: "NIHOVCAR3" },
  { id: "ACH-000552", label: "HT29" },
  { id: "ACH-000001", label: "MCF7" },
];

const geneIdentifiers = [
  { id: "ENSG00000164687", label: "FABP5" },
  { id: "ENSG00000181449", label: "SOX2" },
  { id: "ENSG00000176697", label: "BDNF" },
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
    name: "gene",
    display_name: "Gene",
    id_column: "entrez_id",
    axis: "feature" as const,
    metadata_dataset_id: "gene_metadata",
  },
];

const chronosDataset = {
  id: "Chronos_Combined",
  given_id: "Chronos_Combined",
  name: "CRISPR (Chronos)",
  format: "matrix_dataset" as const,
  feature_type_name: "gene",
  sample_type_name: "depmap_model",
  units: "Gene effect",
  value_type: "continuous" as const,
  data_type: "CRISPR",
  priority: 1,
};

// Shared mock setup: per-test we'll layer specifics on top.
function mockDimensionTypes() {
  breadboxAPI.getDimensionTypes = jest
    .fn<ReturnType<typeof breadboxAPI.getDimensionTypes>, []>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(dimensionTypes as any);
}

function mockDatasets() {
  breadboxAPI.getDatasets = jest
    .fn<ReturnType<typeof breadboxAPI.getDatasets>, []>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue([chronosDataset] as any);

  breadboxAPI.getDataset = jest
    .fn<ReturnType<typeof breadboxAPI.getDataset>, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(chronosDataset as any);
}

function mockDatasetIdentifiers() {
  breadboxAPI.getDatasetSamples = jest
    .fn<ReturnType<typeof breadboxAPI.getDatasetSamples>, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(modelIdentifiers as any);

  breadboxAPI.getDatasetFeatures = jest
    .fn<ReturnType<typeof breadboxAPI.getDatasetFeatures>, [string]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(geneIdentifiers as any);
}

function mockDimensionTypeIdentifiers() {
  // Used by the metadata fetcher's id→label map. Routed by index_type name.
  breadboxAPI.getDimensionTypeIdentifiers = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string]>()
    .mockImplementation((name: string) => {
      if (name === "depmap_model") {
        return Promise.resolve(modelIdentifiers);
      }
      if (name === "gene") {
        return Promise.resolve(geneIdentifiers);
      }
      return Promise.resolve([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
}

// The matrix-data endpoint always returns Record<feature_id, Record<sample_id, value>>,
// regardless of which `*_identifier: "label"` was requested in the params.
// For the tests below, we shape responses to match the dimension being fetched.
function mockMatrixDataFor(slice: "gene" | "depmap_model") {
  // Selecting one feature (gene) returns one row keyed by that gene id,
  // with all sample ids underneath.
  // Selecting one sample (model) returns all gene ids, each with one
  // entry for that sample id.
  const response =
    slice === "gene"
      ? {
          ENSG00000164687: {
            "ACH-000425": 0.5,
            "ACH-000552": -0.3,
            "ACH-000001": 1.2,
          },
        }
      : {
          ENSG00000164687: { "ACH-000425": 0.5 },
          ENSG00000181449: { "ACH-000425": -0.7 },
          ENSG00000176697: { "ACH-000425": 0.1 },
        };

  breadboxAPI.getMatrixDatasetData = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<ReturnType<typeof breadboxAPI.getMatrixDatasetData>, [string, any]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(response as any);
}

// `fetchPlotDimensions` will *unconditionally* fetch two hardcoded metadata
// columns when `index_type === "depmap_model"` (OncotreePrimaryDisease,
// OncotreeLineage on depmap_model_metadata, both routed as `column` slices
// through `getTabularDatasetData`). Mock a response keyed by depmap ids.
function mockDepmapModelHardcodedExtras() {
  breadboxAPI.getTabularDatasetData = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [string, any]>()
    .mockImplementation((_datasetId: string, params: { columns: string[] }) => {
      const out: Record<string, Record<string, string | null>> = {};
      for (const column of params.columns) {
        out[column] = {
          "ACH-000425": `${column}_NIHOVCAR3`,
          "ACH-000552": `${column}_HT29`,
          "ACH-000001": `${column}_MCF7`,
        };
      }
      return Promise.resolve(out);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
}

// Asserts the structural invariants of the new contract: index_ids and
// index_labels are aligned, every id maps to the expected label, every
// label is the real label (not the id repeated), and every returned
// values array is aligned with index_ids.
function expectIdsAndLabelsAligned(
  response: DataExplorerPlotResponse,
  expectedIdToLabel: Record<string, string>
) {
  expect(response.index_ids).toBeDefined();
  expect(response.index_labels).toBeDefined();
  expect(response.index_ids.length).toBe(response.index_labels.length);

  for (let i = 0; i < response.index_ids.length; i += 1) {
    const id = response.index_ids[i];
    const label = response.index_labels[i];
    expect(expectedIdToLabel[id]).toBeDefined();
    // The label is the *real* display label, not the id mirrored back.
    // This catches the regression where `depmap_model` carried IDs in
    // `index_labels` for legacy-compat reasons.
    expect(label).toBe(expectedIdToLabel[id]);
  }

  // Dimension value arrays are aligned with index_ids.
  Object.values(response.dimensions || {}).forEach((dim) => {
    if (dim && Array.isArray(dim.values)) {
      expect(dim.values.length).toBe(response.index_ids.length);
    }
  });
}

describe("buildExtendedMetadata", () => {
  // Regression: color_property and facet_property are two independently
  // required, differently-named metadata keys. If a user happens to pick
  // the *same* underlying annotation for both color_by and facet_by, both
  // keys must still survive in the extended metadata — each is read by
  // exact name downstream (findCategoricalSlice reads metadata.color_property
  // vs metadata.facet_property specifically). The dedup-by-value `addIfNew`
  // helper is correct for section 2/3 (hardcoded extras, anonymous context
  // vars) but must never apply across section 1's user-selected keys, or
  // whichever key is processed second gets silently dropped — breaking
  // that axis while leaving the other looking fine. This is also why the
  // symptom was flaky: JS object key order differs between a live-built
  // metadata object and a freshly-parsed URL, so which axis "won" flipped
  // between editing live and reloading the page.
  test("color_property and facet_property both survive when they reference the identical slice", () => {
    const identicalSlice = {
      dataset_id: "lineage-dataset",
      identifier: "lineage",
      identifier_type: "column" as const,
    };

    const result = buildExtendedMetadata("depmap_model", "depmap_id", {
      facet_property: identicalSlice,
      color_property: identicalSlice,
    });

    expect(result.facet_property).toEqual(identicalSlice);
    expect(result.color_property).toEqual(identicalSlice);
  });

  test("order of the input metadata object doesn't change which keys survive", () => {
    const identicalSlice = {
      dataset_id: "lineage-dataset",
      identifier: "lineage",
      identifier_type: "column" as const,
    };

    // Same as above but with keys inserted in the opposite order — pins
    // that survival isn't accidentally order-dependent in either direction.
    const result = buildExtendedMetadata("depmap_model", "depmap_id", {
      color_property: identicalSlice,
      facet_property: identicalSlice,
    });

    expect(result.facet_property).toEqual(identicalSlice);
    expect(result.color_property).toEqual(identicalSlice);
  });

  test("still dedupes hardcoded extras against a user-selected key with the same value", () => {
    const result = buildExtendedMetadata("depmap_model", "depmap_id", {
      color_property: {
        dataset_id: "depmap_model_metadata",
        identifier: "OncotreeLineage",
        identifier_type: "column" as const,
      },
    });

    // color_property survives under its own name...
    expect(result.color_property).toBeDefined();
    // ...and the hardcoded extra1 (same slice) is skipped as redundant,
    // rather than duplicating the fetch under a second key.
    expect(result.extra1).toBeUndefined();
  });

  test("skips a filter var that is the flat root 'label' (redundant with the always-fetched root label)", () => {
    const result = buildExtendedMetadata("screen_pair", "pair_id", undefined, {
      visible: {
        name: "visible",
        dimension_type: "screen_pair",
        expr: { "==": [{ var: "x" }, "foo"] },
        vars: {
          x: {
            dataset_id: "screen_pair_metadata",
            identifier: "label",
            identifier_type: "column",
          },
        },
      },
    });

    expect(Object.keys(result)).toHaveLength(0);
  });

  test("keeps a chained 'label' var reached via reindex_through — it's a distinct column, not the root's", () => {
    // "label" is reserved and present on every dimension type's own
    // metadata table, not a single global column. A filter on screen_pair
    // referencing screen's label (via CtrlArmScreenID) is genuinely
    // different data from screen_pair's own root label, and must not be
    // dropped just because its terminal identifier happens to be "label".
    const result = buildExtendedMetadata("screen_pair", "pair_id", undefined, {
      visible: {
        name: "visible",
        dimension_type: "screen_pair",
        expr: { "==": [{ var: "x" }, "foo"] },
        vars: {
          x: {
            dataset_id: "screen_metadata",
            identifier: "label",
            identifier_type: "column",
            reindex_through: {
              dataset_id: "screen_pair_metadata",
              identifier: "CtrlArmScreenID",
              identifier_type: "column",
            },
          },
        },
      },
    });

    expect(Object.keys(result)).toHaveLength(1);
    expect(result.context_var_0).toEqual({
      dataset_id: "screen_metadata",
      identifier: "label",
      identifier_type: "column",
      reindex_through: {
        dataset_id: "screen_pair_metadata",
        identifier: "CtrlArmScreenID",
        identifier_type: "column",
      },
    });
  });
});

describe("fetchPlotDimensions", () => {
  describe("with depmap_model index_type", () => {
    test("raw_slice dimension produces aligned index_ids and index_labels", async () => {
      mockDimensionTypes();
      mockDatasets();
      mockDatasetIdentifiers();
      mockDimensionTypeIdentifiers();
      mockMatrixDataFor("gene");
      mockDepmapModelHardcodedExtras();

      const xDimension: DataExplorerPlotConfigDimension = {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "FABP5",
          context_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "FABP5"] },
        },
      };

      const response = await fetchPlotDimensions("depmap_model", {
        x: xDimension,
      });

      const expectedMap = Object.fromEntries(
        modelIdentifiers.map(({ id, label }) => [id, label])
      );

      expectIdsAndLabelsAligned(response, expectedMap);

      // The id column name is forwarded from Breadbox.
      expect(response.index_id_column).toBe("depmap_id");

      // Every returned id is a real depmap id.
      response.index_ids.forEach((id) => {
        expect(id).toMatch(/^ACH-/);
      });
    });

    test("a 'facet' custom dimension is populated in the response, mirroring 'color'", async () => {
      mockDimensionTypes();
      mockDatasets();
      mockDatasetIdentifiers();
      mockDimensionTypeIdentifiers();
      mockMatrixDataFor("gene");
      mockDepmapModelHardcodedExtras();

      const xDimension: DataExplorerPlotConfigDimension = {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "FABP5",
          context_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "FABP5"] },
        },
      };

      const groupDimension: DataExplorerPlotConfigDimension = {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "gene",
        dataset_id: "Chronos_Combined",
        context: {
          name: "FABP5",
          context_type: "gene",
          expr: { "==": [{ var: "entity_label" }, "FABP5"] },
        },
      };

      const response = await fetchPlotDimensions("depmap_model", {
        x: xDimension,
        facet: groupDimension,
      });

      expect(response.dimensions.facet).toBeDefined();
      expect(response.dimensions.facet?.slice_type).toBe("gene");
      expect(response.dimensions.facet?.dataset_id).toBe("Chronos_Combined");
      expect(response.dimensions.facet?.values.length).toBe(
        response.index_ids.length
      );
      // facet is independent of color: no color dimension was supplied.
      expect(response.dimensions.color).toBeUndefined();
    });
  });

  describe("with gene index_type", () => {
    test("raw_slice dimension produces aligned index_ids and index_labels", async () => {
      mockDimensionTypes();
      mockDatasets();
      mockDatasetIdentifiers();
      mockDimensionTypeIdentifiers();
      mockMatrixDataFor("depmap_model");

      const xDimension: DataExplorerPlotConfigDimension = {
        axis_type: "raw_slice",
        aggregation: "first",
        slice_type: "depmap_model",
        dataset_id: "Chronos_Combined",
        context: {
          name: "NIHOVCAR3",
          context_type: "depmap_model",
          expr: { "==": [{ var: "entity_label" }, "ACH-000425"] },
        },
      };

      const response = await fetchPlotDimensions("gene", {
        x: xDimension,
      });

      const expectedMap = Object.fromEntries(
        geneIdentifiers.map(({ id, label }) => [id, label])
      );

      expectIdsAndLabelsAligned(response, expectedMap);

      // The id column name is forwarded from Breadbox.
      expect(response.index_id_column).toBe("entrez_id");

      // Every returned id is a real gene id.
      response.index_ids.forEach((id) => {
        expect(id).toMatch(/^ENSG/);
      });
    });
  });
});

// Correlation-specific fixtures. These genes are chosen so the correlation
// matrix has a unique, predictable structure: GENE_A and GENE_B are
// perfectly correlated; GENE_C is perfectly anti-correlated with both.
const correlationGeneIdentifiers = [
  { id: "11111", label: "GENE_A" },
  { id: "22222", label: "GENE_B" },
  { id: "33333", label: "GENE_C" },
];

// For the matrix request: features × samples, with sample IDs as inner keys.
// GENE_A and GENE_B have identical value rows (ρ = 1).
// GENE_C has reversed values (ρ = −1 vs A and B).
const correlationMatrixResponse = {
  GENE_A: {
    "ACH-000001": 1.0,
    "ACH-000002": 2.0,
    "ACH-000003": 3.0,
    "ACH-000004": 4.0,
  },
  GENE_B: {
    "ACH-000001": 1.0,
    "ACH-000002": 2.0,
    "ACH-000003": 3.0,
    "ACH-000004": 4.0,
  },
  GENE_C: {
    "ACH-000001": 4.0,
    "ACH-000002": 3.0,
    "ACH-000003": 2.0,
    "ACH-000004": 1.0,
  },
};

function mockCorrelationContext() {
  // `correlateDimension` calls `evaluateContext` on the input context
  // (and on `filter` if one is provided — not here). Returns the parallel
  // labels and ids arrays for the genes being correlated.
  breadboxAPI.evaluateContext = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<any, [any]>()
    .mockResolvedValue({
      ids: correlationGeneIdentifiers.map((g) => g.id),
      labels: correlationGeneIdentifiers.map((g) => g.label),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as any;
}

function mockCorrelationMatrixData() {
  breadboxAPI.getMatrixDatasetData = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .fn<ReturnType<typeof breadboxAPI.getMatrixDatasetData>, [string, any]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(correlationMatrixResponse as any);
}

describe("fetchCorrelation", () => {
  const xDimension: DataExplorerPlotConfigDimension = ({
    axis_type: "aggregated_slice",
    aggregation: "correlation",
    slice_type: "gene",
    dataset_id: "Chronos_Combined",
    context: {
      name: "(3 selected)",
      context_type: "gene",
      expr: {
        in: [{ var: "given_id" }, ["11111", "22222", "33333"]],
      },
      vars: {},
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown) as any;

  const setupMocks = () => {
    mockDimensionTypes();
    mockDatasets();
    mockDatasetIdentifiers();
    mockDimensionTypeIdentifiers();
    mockCorrelationContext();
    mockCorrelationMatrixData();
  };

  // Helper: find each gene's position in the response so assertions can be
  // written without depending on a specific clustering order.
  const positionsOf = (response: DataExplorerPlotResponse) => {
    const idToIndex: Record<string, number> = {};
    response.index_ids.forEach((id, i) => {
      idToIndex[id] = i;
    });
    return idToIndex;
  };

  test("returns aligned index_ids and index_labels for gene-by-gene correlation", async () => {
    setupMocks();

    const response = await fetchCorrelation("gene", { x: xDimension });

    // The fundamental invariant: ids and labels are parallel arrays of
    // equal length, and each (id, label) pair refers to the same gene.
    expect(response.index_ids.length).toBe(3);
    expect(response.index_labels.length).toBe(3);

    const labelById = Object.fromEntries(
      correlationGeneIdentifiers.map(({ id, label }) => [id, label])
    );
    for (let i = 0; i < response.index_ids.length; i += 1) {
      expect(response.index_labels[i]).toBe(labelById[response.index_ids[i]]);
    }
  });

  test("matrix rows/columns are aligned with index_ids regardless of clustering order", async () => {
    setupMocks();

    const response = await fetchCorrelation(
      "gene",
      { x: xDimension },
      undefined,
      true
    );
    const matrix = (response.dimensions.x.values as unknown) as number[][];

    expect(matrix.length).toBe(3);
    matrix.forEach((row) => expect(row.length).toBe(3));

    // Diagonal is always self-correlation = 1.
    for (let i = 0; i < 3; i += 1) {
      expect(matrix[i][i]).toBeCloseTo(1, 5);
    }

    // Find each gene's position post-clustering, then verify the matrix
    // cell at those positions matches the expected correlation. This is
    // the regression assertion for patch-10: if `index_ids` got reordered
    // by clustering but the matrix didn't (or vice versa), this fails.
    const pos = positionsOf(response);
    const a = pos["11111"];
    const b = pos["22222"];
    const c = pos["33333"];

    // A and B: perfectly correlated.
    expect(matrix[a][b]).toBeCloseTo(1, 5);
    expect(matrix[b][a]).toBeCloseTo(1, 5);

    // C vs A and B: perfectly anti-correlated.
    expect(matrix[a][c]).toBeCloseTo(-1, 5);
    expect(matrix[c][a]).toBeCloseTo(-1, 5);
    expect(matrix[b][c]).toBeCloseTo(-1, 5);
    expect(matrix[c][b]).toBeCloseTo(-1, 5);
  });

  test("the id_column name is forwarded from Breadbox", async () => {
    setupMocks();

    const response = await fetchCorrelation("gene", { x: xDimension });

    expect(response.index_id_column).toBe("entrez_id");
  });

  // Regression: with both distinguish1 and distinguish2, each correlateDimension
  // call runs an independent clustering pass. The two passes can produce different
  // column orders. Without realignment, x2.values[i][j] describes a different gene
  // pair than x.values[i][j] (and index_ids[i/j]), so a selected heatmap cell shows
  // the wrong correlation value from the second heatmap.
  test("x2 matrix is aligned with index_ids when clustering and distinguish2 are both active", async () => {
    mockDimensionTypes();
    mockDatasets();
    mockDatasetIdentifiers();
    mockDimensionTypeIdentifiers();

    // distinguish1 data: GENE_A and GENE_B perfectly correlated, GENE_C anti-correlated.
    // Clustering will place A and B adjacent.
    const distinguish1MatrixResponse = {
      GENE_A: { S1: 1.0, S2: 2.0, S3: 3.0, S4: 4.0 },
      GENE_B: { S1: 1.0, S2: 2.0, S3: 3.0, S4: 4.0 },
      GENE_C: { S1: 4.0, S2: 3.0, S3: 2.0, S4: 1.0 },
    };

    // distinguish2 data: GENE_A and GENE_C perfectly correlated, GENE_B anti-correlated.
    // Independent clustering would place A and C adjacent — a different order than x.
    const distinguish2MatrixResponse = {
      GENE_A: { T1: 1.0, T2: 2.0, T3: 3.0, T4: 4.0 },
      GENE_B: { T1: 4.0, T2: 3.0, T3: 2.0, T4: 1.0 },
      GENE_C: { T1: 1.0, T2: 2.0, T3: 3.0, T4: 4.0 },
    };

    const distinguish1Context = {
      name: "filter1",
      context_type: "depmap_model",
      expr: { in: [{ var: "given_id" }, ["S1", "S2", "S3", "S4"]] },
    };
    const distinguish2Context = {
      name: "filter2",
      context_type: "depmap_model",
      expr: { in: [{ var: "given_id" }, ["T1", "T2", "T3", "T4"]] },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    breadboxAPI.evaluateContext = jest.fn<any, [any]>().mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx: any) => {
        if (ctx === distinguish1Context) {
          return Promise.resolve({ ids: ["S1", "S2", "S3", "S4"], labels: ["S1", "S2", "S3", "S4"] });
        }
        if (ctx === distinguish2Context) {
          return Promise.resolve({ ids: ["T1", "T2", "T3", "T4"], labels: ["T1", "T2", "T3", "T4"] });
        }
        // Gene context
        return Promise.resolve({
          ids: correlationGeneIdentifiers.map((g) => g.id),
          labels: correlationGeneIdentifiers.map((g) => g.label),
        });
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

    breadboxAPI.getMatrixDatasetData = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fn<ReturnType<typeof breadboxAPI.getMatrixDatasetData>, [string, any]>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((_datasetId: string, params: any) => {
        const samples: string[] = params.samples || [];
        if (samples.includes("S1")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return Promise.resolve(distinguish1MatrixResponse as any);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Promise.resolve(distinguish2MatrixResponse as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const response = await fetchCorrelation(
      "gene",
      { x: xDimension },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { distinguish1: distinguish1Context as any, distinguish2: distinguish2Context as any },
      true
    );

    const x1Matrix = response.dimensions.x.values as unknown as number[][];
    const x2Matrix = (response.dimensions as any).x2?.values as unknown as number[][];

    expect(x2Matrix).toBeDefined();

    // Build a lookup by id so assertions are independent of clustering order.
    const idToPos: Record<string, number> = {};
    response.index_ids.forEach((id, i) => { idToPos[id] = i; });

    const a = idToPos["11111"]; // GENE_A
    const b = idToPos["22222"]; // GENE_B
    const c = idToPos["33333"]; // GENE_C

    // x (distinguish1): A↔B = 1, A↔C = B↔C = -1
    expect(x1Matrix[a][b]).toBeCloseTo(1, 5);
    expect(x1Matrix[a][c]).toBeCloseTo(-1, 5);
    expect(x1Matrix[b][c]).toBeCloseTo(-1, 5);

    // x2 (distinguish2): A↔C = 1, A↔B = B↔C = -1.
    // Before the fix, x2's matrix was in a different clustering order than index_ids,
    // so these look-ups by index_ids position would return wrong values.
    expect(x2Matrix[a][c]).toBeCloseTo(1, 5);
    expect(x2Matrix[a][b]).toBeCloseTo(-1, 5);
    expect(x2Matrix[b][c]).toBeCloseTo(-1, 5);
  });
});
