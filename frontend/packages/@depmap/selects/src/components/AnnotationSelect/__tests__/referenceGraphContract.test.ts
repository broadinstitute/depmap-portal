import * as fs from "fs";
import * as path from "path";
import type { SliceQuery } from "@depmap/types";
import computeLevel from "../computeLevel";
import { buildDimTypeMap, buildTablesByDim } from "../schemaHelpers";
import { buildSliceQuery, serializeSliceQuery } from "../sliceQueryUtils";

// The other half of this contract lives in Breadbox:
// test_reachable_matches_contract_fixture (tests/api/test_types.py). Both read
// the same fixtures, which are generated from the live schema:
//
//   schema.json     /types/dimensions + /datasets (trimmed)
//   reachable.json  what GET /types/dimensions/{name}/reachable returns for it
//
// To refresh after a schema change, see refresh_schema.py in that directory.
const FIXTURE_DIR = path.resolve(
  __dirname,
  "../../../../../../../../breadbox/tests/fixtures/reference_graph"
);

const readFixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8"));

const SCHEMA = readFixture("schema.json");
// One line per reachable table; see _contract_projection in tests/api/test_types.py.
const REACHABLE: Record<string, string[]> = readFixture("reachable.json");

const DIM_TYPES = SCHEMA.dimension_types as any[];
const DATASETS = SCHEMA.tabular_datasets as any[];

/** Every query the annotation picker lets a user build, keyed for comparison. */
function pickerSelections(datasets: any[], indexType: string) {
  const dimTypeMap = buildDimTypeMap(DIM_TYPES as any);
  const tablesByDim = buildTablesByDim(datasets);
  const out = new Map<string, SliceQuery>();

  const record = (query: SliceQuery) =>
    out.set(serializeSliceQuery(query), query);

  for (const start of tablesByDim[indexType] ?? []) {
    const source = { id: start.id, given_id: start.given_id };
    const isPrimary = dimTypeMap[indexType].metadata_dataset_id === start.id;

    const visit = (hops: { throughCol: string; toDim: string }[]) => {
      const dim = hops.length ? hops[hops.length - 1].toDim : indexType;
      const visited = new Set([indexType]);
      hops.slice(0, -1).forEach((h) => visited.add(h.toDim));

      // Mirrors ChainColumnPicker: a non-primary source is the start table
      // only before any door has been clicked.
      const level = computeLevel(
        dim,
        indexType,
        tablesByDim,
        dimTypeMap,
        visited,
        !isPrimary && hops.length === 0 ? start : undefined
      );

      for (const entry of level.columns) {
        record(
          buildSliceQuery(
            entry.columnName,
            entry,
            hops,
            null,
            source,
            indexType,
            tablesByDim,
            dimTypeMap
          )
        );
      }

      for (const st of level.supplementalTables) {
        for (const columnName of Object.keys(st.table.columns)) {
          record(
            buildSliceQuery(
              columnName,
              null,
              hops,
              {
                tableId: st.table.id,
                dimType: st.dimType,
                autoPath: st.autoPath,
              },
              source,
              indexType,
              tablesByDim,
              dimTypeMap
            )
          );
        }
      }

      for (const door of level.doors) {
        visit([
          ...hops,
          { throughCol: door.columnName, toDim: door.targetDim },
        ]);
      }
    };

    visit([]);
  }

  return out;
}

/** The queries Breadbox's endpoint says a caller can use, by offered flag. */
function backendQueries(indexType: string) {
  const offered = new Map<string, SliceQuery>();
  const unoffered = new Map<string, SliceQuery>();

  const columnsBySliceId = new Map<string, string[]>();
  DATASETS.forEach((d) =>
    columnsBySliceId.set(d.given_id || d.id, Object.keys(d.columns_metadata))
  );

  for (const line of REACHABLE[indexType]) {
    const [flag, hops, end] = line.split(" | ");

    for (const column of columnsBySliceId.get(end) ?? []) {
      // Steps run innermost first, so each step wraps the chain built so far.
      let chain: SliceQuery | undefined;

      for (const step of hops ? hops.split(" > ") : []) {
        const [dataset_id, identifier] = step.split(".");

        chain = {
          dataset_id,
          identifier,
          identifier_type: "column",
          ...(chain && { reindex_through: chain }),
        };
      }

      // The outermost object is the data column.
      const query: SliceQuery = {
        dataset_id: end,
        identifier: column,
        identifier_type: "column",
        ...(chain && { reindex_through: chain }),
      };

      const bucket = flag === "offered" ? offered : unoffered;

      bucket.set(serializeSliceQuery(query), query);
    }
  }

  return { offered, unoffered };
}

const reversedColumns = (datasets: any[]) =>
  datasets.map((d) => ({
    ...d,
    columns_metadata: Object.fromEntries(
      Object.entries(d.columns_metadata).reverse()
    ),
  }));

describe("reference graph contract with Breadbox", () => {
  it("covers every dimension type in the schema", () => {
    expect(Object.keys(REACHABLE).sort()).toEqual(
      DIM_TYPES.map((t) => t.name).sort()
    );
  });

  describe.each(DIM_TYPES.map((t) => t.name as string))("%s", (indexType) => {
    const picker = pickerSelections(DATASETS, indexType);
    const { offered, unoffered } = backendQueries(indexType);

    // Urgent direction: Delphi would emit a link whose chain the picker cannot
    // render as its own selection.
    it("offers every query Breadbox flags offered_by_picker", () => {
      const missing = [...offered.keys()].filter((k) => !picker.has(k));

      expect(missing).toEqual([]);
    });

    // Drift in the other direction: the picker offers something the Python
    // port of its rules does not, so the flag is wrong.
    it("flags every query the picker offers as offered_by_picker", () => {
      const unflagged = [...picker.keys()].filter((k) => !offered.has(k));

      // Distinguish "listed but unflagged" from "not listed at all".
      const notListed = unflagged.filter((k) => !unoffered.has(k));
      const wronglyUnflagged = unflagged.filter((k) => unoffered.has(k));

      expect({ notListed, wronglyUnflagged }).toEqual({
        notListed: [],
        wronglyUnflagged: [],
      });
    });

    // The picker never depended on column order (ADR 0013); neither may the
    // contract.
    it("does not depend on column order", () => {
      const reversed = pickerSelections(reversedColumns(DATASETS), indexType);

      expect([...reversed.keys()].sort()).toEqual([...picker.keys()].sort());
    });
  });
});
