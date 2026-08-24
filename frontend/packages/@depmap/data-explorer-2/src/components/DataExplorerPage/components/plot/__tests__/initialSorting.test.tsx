import React from "react";
import { render, screen } from "@testing-library/react";
import ReactTable from "@depmap/react-table";

// ReactTable's `initialSorting`, tested from here for the same reason
// categorySelectAll.test.tsx is: @depmap/react-table has no test setup of its
// own, and what matters is the behavior a consumer gets.
//
// jsdom reports no layout, so the virtualizer renders nothing by default. These
// stubs give it a size to work with; without them the body is empty and every
// assertion about row order passes vacuously.
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

const rows: Row[] = [
  { name: "alpha", score: 2 },
  { name: "bravo", score: 9 },
  { name: "charlie", score: 5 },
];

const columns = [
  { accessorKey: "name", header: "Name" },
  { id: "score", accessorKey: "score", header: "Score" },
];

const renderedNames = () =>
  rows
    .map((r) => ({ name: r.name, el: screen.queryByText(r.name) }))
    .filter((x) => x.el)
    .sort((a, b) =>
      (a.el as HTMLElement).compareDocumentPosition(b.el as HTMLElement) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1
    )
    .map((x) => x.name);

test("opens sorted by the named column", () => {
  render(
    <ReactTable<Row>
      columns={columns}
      data={rows}
      height={400}
      getRowId={(row) => row.name}
      initialSorting={[{ id: "score", desc: true }]}
    />
  );

  expect(renderedNames()).toEqual(["bravo", "charlie", "alpha"]);
});

test("ascending is the other direction, not the same one", () => {
  render(
    <ReactTable<Row>
      columns={columns}
      data={rows}
      height={400}
      getRowId={(row) => row.name}
      initialSorting={[{ id: "score", desc: false }]}
    />
  );

  expect(renderedNames()).toEqual(["alpha", "charlie", "bravo"]);
});

test("an initial sort suppresses defaultSort", () => {
  // The two answer different questions and must not both apply: a header
  // showing a sort indicator should mean that sort is what ordered the rows.
  render(
    <ReactTable<Row>
      columns={columns}
      data={rows}
      height={400}
      getRowId={(row) => row.name}
      initialSorting={[{ id: "score", desc: true }]}
      defaultSort={(a, b) => a.name.localeCompare(b.name)}
    />
  );

  expect(renderedNames()).toEqual(["bravo", "charlie", "alpha"]);
});

test("defaultSort still applies when no initial sort is given", () => {
  render(
    <ReactTable<Row>
      columns={columns}
      data={rows}
      height={400}
      getRowId={(row) => row.name}
      defaultSort={(a, b) => b.score - a.score}
    />
  );

  expect(renderedNames()).toEqual(["bravo", "charlie", "alpha"]);
});
