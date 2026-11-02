import React from "react";
import { render, waitFor } from "@testing-library/react";
import { SliceQuery } from "@depmap/types";
import useAlignedData from "../components/useData";

// Explicit, not the automock: @depmap/api's automock is configured per package
// and this one doesn't get it.
jest.mock("@depmap/api", () => {
  const breadboxAPI = {
    getDimensionType: jest.fn(),
    getDatasets: jest.fn(),
    getDimensionData: jest.fn(),
  };

  return {
    breadboxAPI,
    // The persist option is irrelevant here; what matters is that the decorator
    // is transparent so the calls land on the mock above.
    cached: () => breadboxAPI,
    getDimensionTypeIdentifiersPersisted: jest.fn().mockResolvedValue([]),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { breadboxAPI } = require("@depmap/api");

const METADATA_DATASET_ID = "transcript_metadata";
const ANNOTATIONS_DATASET_ID = "transcript_annotations";

const SEQUENCE_SLICE: SliceQuery = {
  dataset_id: ANNOTATIONS_DATASET_ID,
  identifier_type: "column",
  identifier: "sequence",
};

const ALL_IDS = ["T1", "T2", "T3", "T4"];

function mockBackend() {
  breadboxAPI.getDimensionType.mockResolvedValue({
    name: "transcript",
    display_name: "Transcript",
    id_column: "transcript_id",
    metadata_dataset_id: METADATA_DATASET_ID,
  });

  breadboxAPI.getDatasets.mockResolvedValue([
    {
      id: METADATA_DATASET_ID,
      given_id: METADATA_DATASET_ID,
      name: "Transcript metadata",
      format: "tabular_dataset",
      columns_metadata: { label: { col_type: "text" } },
    },
    {
      id: ANNOTATIONS_DATASET_ID,
      given_id: ANNOTATIONS_DATASET_ID,
      name: "Transcript annotations",
      format: "tabular_dataset",
      columns_metadata: { sequence: { col_type: "text" } },
    },
  ]);

  breadboxAPI.getDimensionData.mockImplementation(
    (slice: SliceQuery, indices?: string[]) => {
      const ids = indices ?? ALL_IDS;

      return Promise.resolve({
        ids,
        labels: ids,
        values: ids.map((id) => `${slice.identifier}:${id}`),
      });
    }
  );
}

// A hook needs a component to live in; @testing-library/react is on v11 here,
// which has no renderHook.
function Harness({ rowIds }: { rowIds?: Set<string> }) {
  const slices = React.useMemo(() => [SEQUENCE_SLICE], []);
  const { data, loading } = useAlignedData({
    index_type_name: "transcript",
    slices,
    rowIds,
  });

  return (
    <div data-testid="rows">
      {loading ? "loading" : data.map((row) => row.id).join(",")}
    </div>
  );
}

describe("useAlignedData row scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackend();
  });

  it("fetches every row when the caller supplies no row set", async () => {
    const { getByTestId } = render(<Harness />);

    await waitFor(() =>
      expect(getByTestId("rows").textContent).toBe(ALL_IDS.join(","))
    );

    for (const call of breadboxAPI.getDimensionData.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });

  it("pushes the caller's row set down into every fetch", async () => {
    const rowIds = new Set(["T3", "T1"]);
    const { getByTestId } = render(<Harness rowIds={rowIds} />);

    await waitFor(() => expect(getByTestId("rows").textContent).toBe("T1,T3"));

    // Both the label slice and the data slice, and sorted — the row set reaches
    // the persistent cache key, so an unstable order would cost every hit.
    expect(breadboxAPI.getDimensionData).toHaveBeenCalledTimes(2);
    for (const call of breadboxAPI.getDimensionData.mock.calls) {
      expect(call[1]).toEqual(["T1", "T3"]);
    }
  });

  it("produces the same rows as fetching everything and filtering after", async () => {
    const rowIds = new Set(["T1", "T3"]);

    // Unmounted between renders: both harnesses render into document.body, so
    // otherwise the queries below match two nodes apiece.
    const scoped = render(<Harness rowIds={rowIds} />);
    await waitFor(() =>
      expect(scoped.getByTestId("rows").textContent).toBe("T1,T3")
    );
    const scopedRows = scoped.getByTestId("rows").textContent;
    scoped.unmount();

    // Same slice, unscoped, then narrowed client-side the way an id-testing
    // `implicitFilter` would have.
    const unscoped = render(<Harness />);
    await waitFor(() =>
      expect(unscoped.getByTestId("rows").textContent).toBe(ALL_IDS.join(","))
    );

    const filtered = unscoped
      .getByTestId("rows")
      .textContent!.split(",")
      .filter((id) => rowIds.has(id));

    expect(filtered.join(",")).toBe(scopedRows);
  });

  it("leaves reindex_through chains unscoped, since the backend rejects both", async () => {
    const chained: SliceQuery = {
      ...SEQUENCE_SLICE,
      reindex_through: {
        dataset_id: METADATA_DATASET_ID,
        identifier_type: "column",
        identifier: "gene_id",
      },
    };

    const rowIds = new Set(["T1"]);

    function ChainHarness() {
      const slices = React.useMemo(() => [chained], []);
      const { loading } = useAlignedData({
        index_type_name: "transcript",
        slices,
        rowIds,
      });

      return <div data-testid="rows">{loading ? "loading" : "done"}</div>;
    }

    const { getByTestId } = render(<ChainHarness />);
    await waitFor(() => expect(getByTestId("rows").textContent).toBe("done"));

    const chainCall = breadboxAPI.getDimensionData.mock.calls.find(
      ([slice]: [SliceQuery]) => Boolean(slice.reindex_through)
    );

    expect(chainCall).toBeTruthy();
    expect(chainCall[1]).toBeUndefined();
  });
});
