import { filterPredicate } from "../useSliceTableState";
import { createUniqueColumnKey } from "../useData";

// What `implicitFilter`'s `getValue` can and cannot see.
//
// Pinned because the failure is silent and reads like a data problem rather
// than a wiring one: naming an unloaded slice returns `undefined`, `undefined`
// compares unequal to whatever the caller meant, and the table drops every row.
// showGeneTranscriptTable shipped that way and showed an empty modal.

const TRANSCRIPT_SLICE = {
  dataset_id: "transcript_metadata",
  identifier: "Transcript",
  identifier_type: "column" as const,
};

const GENE_SLICE = {
  dataset_id: "transcript_metadata",
  identifier: "Gene",
  identifier_type: "column" as const,
};

const columnFor = (id: string, sliceQuery: typeof TRANSCRIPT_SLICE) => ({
  id,
  meta: { sliceQuery },
});

describe("filterPredicate — getValue", () => {
  it("resolves a slice that is a loaded column", () => {
    const predicate = filterPredicate(
      [columnFor("col-gene", GENE_SLICE)],
      ({ getValue }) => getValue(GENE_SLICE) === "CD44"
    );

    expect(
      predicate({ id: "ENST1", label: "CD44-201", "col-gene": "CD44" })
    ).toBe(true);
    expect(
      predicate({ id: "ENST2", label: "SOX10-201", "col-gene": "SOX10" })
    ).toBe(false);
  });

  it("resolves a slice that was a column and has since been removed", () => {
    // The cache is what makes removing a column not silently change the filter.
    // Keyed with the implementation's own function rather than a literal, so
    // this tests the lookup and not my guess at the key format.
    const cache = new Map([
      [createUniqueColumnKey(GENE_SLICE), new Map([["ENST1", "CD44"]])],
    ]);

    const predicate = filterPredicate(
      [columnFor("col-transcript", TRANSCRIPT_SLICE)],
      ({ getValue }) => getValue(GENE_SLICE) === "CD44",
      cache
    );

    expect(predicate({ id: "ENST1", label: "CD44-201" })).toBe(true);
  });

  it("returns undefined for a slice that was never loaded", () => {
    let observed: unknown = "never called";

    const predicate = filterPredicate(
      [columnFor("col-transcript", TRANSCRIPT_SLICE)],
      ({ getValue }) => {
        observed = getValue(GENE_SLICE);
        return observed === "CD44";
      },
      new Map()
    );

    const kept = predicate({
      id: "ENST1",
      label: "CD44-201",
      "col-transcript": "CD44-201",
    });

    expect(observed).toBeUndefined();
    // The trap: a row whose gene IS CD44 is dropped anyway, because the filter
    // was comparing against a value the table never fetched.
    expect(kept).toBe(false);
  });
});
