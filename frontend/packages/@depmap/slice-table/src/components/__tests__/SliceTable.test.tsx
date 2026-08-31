import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SliceQuery } from "@depmap/types";
import SliceTable from "../SliceTable";

// The hook under the table. Mocked so a test can put the table into the
// only state that matters here: the hard failure, where the index itself
// couldn't be built.
jest.mock("../useData", () => jest.fn());

// `styles` is otherwise an empty object (see __mocks__/styleMock.js), which
// would make "hidden" and "not hidden" both come out as undefined.
jest.mock("../../styles/SliceTable.scss", () => ({
  hidden: "hiddenTable",
}));

// Stands in for the real table so its className — the whole mechanism by
// which a failed load stops rendering "There are no rows to display" — is
// observable without a stylesheet.
jest.mock("@depmap/react-table", () => ({
  __esModule: true,
  default: ({ className }: { className: string }) => (
    <div data-testid="react-table" className={className} />
  ),
  SearchBar: () => <div data-testid="search-bar" />,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const useData = require("../useData") as jest.Mock;

const FAILED_LOAD = {
  columns: [],
  data: [],
  loading: false,
  progress: null,
  error: "Failed to load data: too many requests",
  entityLabel: "",
  exportToCsv: () => "",
};

const SUCCESSFUL_LOAD = { ...FAILED_LOAD, error: null };

const renderTable = (
  props: Partial<React.ComponentProps<typeof SliceTable>> = {}
) =>
  render(
    <SliceTable
      index_type_name="depmap_model"
      PlotlyLoader={() => null}
      {...props}
    />
  );

describe("SliceTable error state", () => {
  it("hides the table and offers a retry when the load fails outright", () => {
    useData.mockReturnValue(FAILED_LOAD);
    renderTable();

    expect(screen.getByText(/error loading the table/)).toBeTruthy();
    expect(screen.getByTestId("react-table").className).toBe("hiddenTable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("leaves the table visible and offers no retry when the load succeeds", () => {
    useData.mockReturnValue(SUCCESSFUL_LOAD);
    renderTable();

    expect(screen.getByTestId("react-table").className).toBe("");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("retries against the caller's re-read initial state, not the slices that just failed", () => {
    useData.mockReturnValue(FAILED_LOAD);

    // Mirrors a caller that drops its persisted columns in `onLoadError`: the
    // first read hands over a set big enough to sink the table, and every
    // read after that hands over nothing. A retry that replayed the original
    // set would fail identically, forever.
    const rememberedColumns: SliceQuery[] = [
      { dataset_id: "d1", identifier_type: "column", identifier: "c1" },
    ];
    let forgotten = false;

    renderTable({
      getInitialState: () => ({
        initialSlices: forgotten ? [] : rememberedColumns,
      }),
      onLoadError: () => {
        forgotten = true;
      },
    });

    const slicesOf = (call: unknown[]) =>
      (call[0] as { slices: SliceQuery[] }).slices;
    const retryTokenOf = (call: unknown[]) =>
      (call[0] as { retryToken: number }).retryToken;

    expect(slicesOf(useData.mock.calls[0])).toEqual(rememberedColumns);

    const callsBeforeRetry = useData.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    const lastCall = useData.mock.calls[useData.mock.calls.length - 1];
    expect(useData.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    expect(slicesOf(lastCall)).toEqual([]);
    expect(retryTokenOf(lastCall)).toBeGreaterThan(
      retryTokenOf(useData.mock.calls[0])
    );
  });

  it("bumps the retry token even when the caller's initial slices are unchanged", () => {
    useData.mockReturnValue(FAILED_LOAD);

    // A caller with nothing to forget hands back the same array every time.
    // Without a token of its own, useData would see identical arguments and
    // never refetch, leaving the button doing nothing at all.
    const stableSlices: SliceQuery[] = [
      { dataset_id: "d1", identifier_type: "column", identifier: "c1" },
    ];

    renderTable({ getInitialState: () => ({ initialSlices: stableSlices }) });

    const tokenBefore = (useData.mock.calls[
      useData.mock.calls.length - 1
    ][0] as { retryToken: number }).retryToken;

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    const tokenAfter = (useData.mock.calls[
      useData.mock.calls.length - 1
    ][0] as { retryToken: number }).retryToken;

    expect(tokenAfter).toBeGreaterThan(tokenBefore);
  });
});
