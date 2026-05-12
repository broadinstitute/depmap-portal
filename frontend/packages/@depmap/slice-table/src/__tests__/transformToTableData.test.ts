import { Dataset, DimensionType, SliceQuery } from "@depmap/types";
import { SliceResponse, transformToTableData } from "../components/useData";

// Minimal valid dataset for the function's lookups (id/given_id matching,
// `format`, `columns_metadata` field reads). Cast to `any` because the
// real `Dataset` type has many more fields that aren't relevant here.
const makeDataset = (id: string, name: string): Dataset =>
  ({
    id,
    given_id: id,
    name,
    format: "tabular_dataset",
    columns_metadata: {},
  } as any);

const indexType = {
  name: "antibody_v2",
  display_name: "Antibody",
  id_column: "antibody_id",
  metadata_dataset_id: "metadata_ds",
} as DimensionType;

const labelSlice: SliceQuery = {
  dataset_id: "metadata_ds",
  identifier_type: "column",
  identifier: "label",
};

const dataSlice: SliceQuery = {
  dataset_id: "data_ds",
  identifier_type: "column",
  identifier: "score",
};

const datasets = [
  makeDataset("metadata_ds", "Metadata"),
  makeDataset("data_ds", "Data"),
];

describe("transformToTableData", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("anchors row assembly on the label response when data is clean", () => {
    const labelResponse: SliceResponse = {
      ids: ["A", "B", "C"],
      labels: ["A", "B", "C"],
      values: ["alpha", "beta", "gamma"],
    };
    const dataResponse: SliceResponse = {
      ids: ["A", "B", "C"],
      labels: ["A", "B", "C"],
      values: [1, 2, 3],
    };

    const { data } = transformToTableData(
      [labelResponse, dataResponse],
      ["label", "Score"],
      [labelSlice, dataSlice],
      undefined,
      datasets,
      indexType,
      "antibody_id",
      "label",
      {}
    );

    expect(data).toHaveLength(3);
    expect(data.map((r) => r.id)).toEqual(["A", "B", "C"]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("drops foreign IDs from a data response and logs the violation", () => {
    const labelResponse: SliceResponse = {
      ids: ["A", "B", "C"],
      labels: ["A", "B", "C"],
      values: ["alpha", "beta", "gamma"],
    };
    // X and Y are foreign — they aren't in the index type's entity set.
    const dataResponse: SliceResponse = {
      ids: ["A", "B", "X", "Y"],
      labels: ["A", "B", "X", "Y"],
      values: [1, 2, 3, 4],
    };

    const { data, columns } = transformToTableData(
      [labelResponse, dataResponse],
      ["label", "Score"],
      [labelSlice, dataSlice],
      undefined,
      datasets,
      indexType,
      "antibody_id",
      "label",
      {}
    );

    // Row set is anchored to the canonical entities — X and Y are gone.
    expect(data).toHaveLength(3);
    expect(data.map((r) => r.id)).toEqual(["A", "B", "C"]);

    // A and B keep their score values; C is a coverage hole (undefined).
    const scoreColumn = columns.find((c) => c.meta.idLabel === "Score")!;
    const scoreKey = scoreColumn.id;
    expect(data[0][scoreKey]).toBe(1);
    expect(data[1][scoreKey]).toBe(2);
    expect(data[2][scoreKey]).toBeUndefined();

    // Should have warned with enough detail to diagnose the upstream bug.
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const message = consoleErrorSpy.mock.calls[0][0] as string;
    expect(message).toContain("Score");
    expect(message).toContain("data_ds");
    expect(message).toContain("score");
    expect(message).toContain("antibody_v2");
    expect(message).toContain("2 of 4");
    expect(message).toContain("X");
    expect(message).toContain("Y");
  });

  it("does not warn for a sparse data response with no foreign IDs", () => {
    const labelResponse: SliceResponse = {
      ids: ["A", "B", "C"],
      labels: ["A", "B", "C"],
      values: ["alpha", "beta", "gamma"],
    };
    // Coverage hole (B and C have no data) is normal and should not warn.
    const dataResponse: SliceResponse = {
      ids: ["A"],
      labels: ["A"],
      values: [1],
    };

    const { data, columns } = transformToTableData(
      [labelResponse, dataResponse],
      ["label", "Score"],
      [labelSlice, dataSlice],
      undefined,
      datasets,
      indexType,
      "antibody_id",
      "label",
      {}
    );

    expect(data).toHaveLength(3);

    const scoreColumn = columns.find((c) => c.meta.idLabel === "Score")!;
    const scoreKey = scoreColumn.id;
    expect(data[0][scoreKey]).toBe(1);
    expect(data[1][scoreKey]).toBeUndefined();
    expect(data[2][scoreKey]).toBeUndefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
