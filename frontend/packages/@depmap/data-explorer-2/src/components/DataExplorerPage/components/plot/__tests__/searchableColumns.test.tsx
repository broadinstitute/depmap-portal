import React, { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ReactTable, { ReactTableHandle, SearchBar } from "@depmap/react-table";

// ReactTable's `searchableColumnIds` and the SearchBar that drives it, tested
// from here for the same reason initialSorting.test.tsx is: @depmap/react-table
// has no test setup of its own, and what matters is the behavior a consumer
// gets. The category picker is that consumer — it searches names while sitting
// next to three columns of computed statistics.
//
// jsdom reports no layout, so the virtualizer renders nothing by default. These
// stubs give it a size to work with.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).ResizeObserver =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).ResizeObserver ||
    class {
      observe() {}

      unobserve() {}

      disconnect() {}
    };

  ["offsetHeight", "clientHeight", "offsetWidth", "clientWidth"].forEach(
    (p) => {
      Object.defineProperty(HTMLElement.prototype, p, {
        configurable: true,
        value: 600,
      });
    }
  );

  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width: 600,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  });
});

type Row = { name: string; score: number };

// "2" appears in a score and in no name, which is the whole point: it is a
// query someone would type to find a category, not a score.
const rows: Row[] = [
  { name: "alpha", score: 2 },
  { name: "bravo", score: 9 },
  { name: "charlie", score: 5 },
];

const columns = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "score", accessorKey: "score", header: "Score" },
];

function Harness({ searchableColumnIds }: { searchableColumnIds?: string[] }) {
  const tableRef = useRef<ReactTableHandle>(null);

  return (
    <div>
      <SearchBar tableRef={tableRef} />
      <ReactTable<Row>
        columns={columns}
        data={rows}
        height={400}
        getRowId={(row) => row.name}
        enableSearch
        searchableColumnIds={searchableColumnIds}
        tableRef={tableRef}
      />
    </div>
  );
}

// SearchBar renders "<current>/<total>" once a query is present.
const search = (query: string) => {
  fireEvent.change(screen.getByPlaceholderText("Find in table"), {
    target: { value: query },
  });
};

const matchCount = () => {
  const el = screen.getByText(/^\d+\/\d+$/);
  return Number(el.textContent!.split("/")[1]);
};

test("searches every visible column when no ids are given", () => {
  render(<Harness />);
  search("2");

  // alpha's score. Nothing anyone was looking for, which is the problem.
  expect(matchCount()).toBe(1);
});

test("restricting to a column ignores matches in the others", () => {
  render(<Harness searchableColumnIds={["name"]} />);
  search("2");

  expect(matchCount()).toBe(0);
});

test("the named column still matches", () => {
  render(<Harness searchableColumnIds={["name"]} />);
  search("a");

  // Every name contains an "a"; restricting must not narrow the column it kept.
  expect(matchCount()).toBe(3);
});

test("a restricted search still counts each name once", () => {
  // Guards against the restriction being applied after matches are collected
  // rather than before: "r" is in bravo and charlie only.
  render(<Harness searchableColumnIds={["name"]} />);
  search("r");

  expect(matchCount()).toBe(2);
});
