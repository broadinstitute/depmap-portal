import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ReactTable, { RowSelectionState } from "@depmap/react-table";

// Select-all under a ceiling, which is what the category picker is. Tested
// through ReactTable with the picker's own configuration rather than through
// the picker: @depmap/react-table has no test setup of its own, and every one
// of the three bugs this covers lived in the interaction between the two
// rather than in either alone.
//
// Only the header checkbox is asserted on. The body is virtualized and jsdom
// reports no layout, so no row renders — which is fine, because what kept
// going wrong was the selection this reports, not the boxes drawing it.

const CAP = 3;

type Row = { category: string };

const rows: Row[] = ["a", "b", "c", "d", "e"].map((category) => ({ category }));

function Harness({
  initial = {},
  onIds,
}: {
  initial?: RowSelectionState;
  onIds: (ids: string[]) => void;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initial);

  return (
    <ReactTable
      columns={[{ accessorKey: "category", header: "Category" }]}
      data={rows}
      height={400}
      getRowId={(row) => row.category}
      enableRowSelection
      enableMultiRowSelection
      maxRowSelection={CAP}
      rowSelection={rowSelection}
      onRowSelectionChange={(updater) => {
        const next =
          typeof updater === "function" ? updater(rowSelection) : updater;
        setRowSelection(next);
        onIds(rows.map((r) => r.category).filter((c) => next[c]));
      }}
    />
  );
}

const clickSelectAll = () => {
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
};

test("takes the top N in display order, not an arbitrary N", () => {
  const seen: string[][] = [];
  render(<Harness onIds={(ids) => seen.push(ids)} />);

  clickSelectAll();

  // Contiguous from the top. The bug this replaces filled the remaining slots
  // from the component's own unsorted array, so which rows survived bore no
  // relation to what was on screen.
  expect(seen[seen.length - 1]).toEqual(["a", "b", "c"]);
});

test("clears from a partial selection instead of selecting more", () => {
  const seen: string[][] = [];
  render(<Harness initial={{ b: true }} onIds={(ids) => seen.push(ids)} />);

  clickSelectAll();

  // The dead end: keyed on "all selected", a partial selection could never be
  // cleared, because the click kept trying to add. Under a ceiling that state
  // is permanent — there is no way to reach "all".
  expect(seen[seen.length - 1]).toEqual([]);
});

test("clears from a full selection", () => {
  const seen: string[][] = [];
  render(
    <Harness
      initial={{ a: true, b: true, c: true }}
      onIds={(ids) => seen.push(ids)}
    />
  );

  clickSelectAll();

  expect(seen[seen.length - 1]).toEqual([]);
});

test("select-all round-trips back to empty", () => {
  const seen: string[][] = [];
  render(<Harness onIds={(ids) => seen.push(ids)} />);

  clickSelectAll();
  clickSelectAll();

  expect(seen[seen.length - 1]).toEqual([]);
});

test("takes everything when there is no ceiling", () => {
  const seen: string[][] = [];

  function NoCap() {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    return (
      <ReactTable<Row>
        columns={[{ accessorKey: "category", header: "Category" }]}
        data={rows}
        height={400}
        getRowId={(row) => row.category}
        enableRowSelection
        enableMultiRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={(updater) => {
          const next =
            typeof updater === "function" ? updater(rowSelection) : updater;
          setRowSelection(next);
          seen.push(rows.map((r) => r.category).filter((c) => next[c]));
        }}
      />
    );
  }

  render(<NoCap />);
  clickSelectAll();

  expect(seen[seen.length - 1]).toEqual(["a", "b", "c", "d", "e"]);
});
