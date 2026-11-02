import {
  forgetRememberedColumns,
  loadRememberedColumns,
  rememberColumns,
} from "../rememberedTableColumns";

const TPM = {
  dataset_id: "transcript_metadata",
  identifier: "TPM",
  identifier_type: "column" as const,
};

const GENE = {
  dataset_id: "transcript_metadata",
  identifier: "Gene",
  identifier_type: "column" as const,
};

// A real in-memory localStorage, installed per test.
//
// NOT `localStorage.clear()` on the ambient one. This package loads
// `jest-localstorage-mock` (see package.json `setupFiles`), whose methods are
// jest.fn()s, and jest-setup.ts calls `jest.resetAllMocks()` in a global
// afterEach — which strips their implementations. The upshot is that only the
// FIRST localStorage-writing test in a file does anything, and every one after
// it silently reads null. Plain functions can't be reset, so these can't rot the
// same way.
beforeEach(() => {
  const store = new Map<string, string>();

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
});

test("round-trips a column set", () => {
  rememberColumns("gene-transcripts", "transcript", [TPM, GENE]);

  expect(loadRememberedColumns("gene-transcripts", "transcript")).toEqual([
    TPM,
    GENE,
  ]);
});

test("nothing stored reads as null, not as an empty set", () => {
  // The distinction callers with default columns depend on.
  expect(loadRememberedColumns("gene-transcripts", "transcript")).toBeNull();
});

test("closing every column is remembered as empty, not forgotten", () => {
  rememberColumns("gene-transcripts", "transcript", [TPM]);
  rememberColumns("gene-transcripts", "transcript", []);

  // Null here would bring a caller's defaults back on reopen, which reads as
  // the table refusing to let a column stay closed.
  expect(loadRememberedColumns("gene-transcripts", "transcript")).toEqual([]);
});

test("scopes over the same slice_type don't share", () => {
  // Both tables are transcript tables; only one of them wants TPM.
  rememberColumns("gene-transcripts", "transcript", [TPM]);

  expect(loadRememberedColumns("expansion-members", "transcript")).toBeNull();
  expect(loadRememberedColumns("gene-transcripts", "transcript")).toEqual([
    TPM,
  ]);
});

test("slice_types within one scope don't share", () => {
  rememberColumns("expansion-members", "transcript", [TPM]);

  expect(
    loadRememberedColumns("expansion-members", "compound_dose")
  ).toBeNull();
});

test("drops slices that have stopped being well-formed", () => {
  // A dataset gets retired and its column stops validating. Losing that one
  // column beats wedging the table for whoever saved it.
  window.localStorage.setItem(
    "data_explorer_2_remembered_table_columns",
    JSON.stringify({
      "gene-transcripts/transcript": [TPM, { identifier: "orphaned" }],
    })
  );

  expect(loadRememberedColumns("gene-transcripts", "transcript")).toEqual([
    TPM,
  ]);
});

test("forgetting reads as never-stored, not as an empty set", () => {
  rememberColumns("expansion-members", "transcript", [TPM, GENE]);
  forgetRememberedColumns("expansion-members", "transcript");

  // Null rather than [] specifically so the caller's defaults come back — the
  // whole point of forgetting a set that couldn't be loaded.
  expect(loadRememberedColumns("expansion-members", "transcript")).toBeNull();
});

test("forgetting leaves other entries alone", () => {
  rememberColumns("expansion-members", "transcript", [TPM]);
  rememberColumns("gene-transcripts", "transcript", [GENE]);

  forgetRememberedColumns("expansion-members", "transcript");

  expect(loadRememberedColumns("gene-transcripts", "transcript")).toEqual([
    GENE,
  ]);
});

test("forgetting something never stored is a no-op", () => {
  expect(() =>
    forgetRememberedColumns("expansion-members", "transcript")
  ).not.toThrow();
});

test("survives storage holding something that isn't JSON", () => {
  window.localStorage.setItem(
    "data_explorer_2_remembered_table_columns",
    "not json{"
  );

  expect(loadRememberedColumns("gene-transcripts", "transcript")).toBeNull();
  // And writing over it recovers rather than throwing.
  expect(() =>
    rememberColumns("gene-transcripts", "transcript", [TPM])
  ).not.toThrow();
  expect(loadRememberedColumns("gene-transcripts", "transcript")).toEqual([
    TPM,
  ]);
});
