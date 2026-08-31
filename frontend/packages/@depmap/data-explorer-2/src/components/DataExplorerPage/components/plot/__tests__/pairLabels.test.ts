import { DataExplorerExpansion, DataExplorerPlotResponse } from "@depmap/types";
import {
  resolvePairLabels,
  toFilenamePart,
} from "../ExpandedPlotSelections/pairLabels";

// The panel listing selected (index entity, expansion member) pairs used to
// name both halves "Model" and "Transcript" outright. These pin the fallback
// chain that replaced them, since the display names it prefers are optional on
// the response and the machine names underneath read very differently.

const response = (over: Partial<DataExplorerPlotResponse>) =>
  (({
    index_type: "depmap_model",
    index_ids: [],
    index_labels: [],
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as DataExplorerPlotResponse);

const expansion = (over: Partial<DataExplorerExpansion>) =>
  (({
    slice_type: "transcript",
    ids: [],
    labels: [],
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as DataExplorerExpansion);

describe("resolvePairLabels", () => {
  it("prefers Breadbox's curated display names", () => {
    expect(
      resolvePairLabels(
        response({ index_display_name: "Cell Line" }),
        expansion({ display_name: "Transcript" })
      )
    ).toEqual({ index: "Cell Line", member: "Transcript" });
  });

  it("names a pair of other types just as readily", () => {
    // The case the hardcoded labels got wrong. Nothing about this function
    // knows which types an expansion is allowed to be made of.
    expect(
      resolvePairLabels(
        response({
          index_type: "compound",
          index_display_name: "Compound",
        }),
        expansion({
          slice_type: "compound_dose",
          display_name: "Compound at dose",
        })
      )
    ).toEqual({ index: "Compound", member: "Compound at dose" });
  });

  it("falls back to the machine-readable type names", () => {
    // Responses assembled without consulting Breadbox carry no display names.
    // Less legible, still about the right thing.
    expect(resolvePairLabels(response({}), expansion({}))).toEqual({
      index: "depmap_model",
      member: "transcript",
    });
  });

  it("falls back again rather than rendering an empty header", () => {
    expect(resolvePairLabels(null, undefined)).toEqual({
      index: "Index",
      member: "Member",
    });
  });
});

describe("toFilenamePart", () => {
  it("makes a multi-word display name safe for a filename", () => {
    expect(toFilenamePart("Compound at dose")).toBe("compound_at_dose");
  });

  it("collapses punctuation rather than carrying it into the filename", () => {
    expect(toFilenamePart("Copy Number (relative)")).toBe(
      "copy_number_relative"
    );
  });

  it("does not leave a leading or trailing separator", () => {
    expect(toFilenamePart("(Viability)")).toBe("viability");
  });

  it("has something to fall back on when nothing survives", () => {
    // "selected_.csv" is worse than a generic name.
    expect(toFilenamePart("—")).toBe("selection");
    expect(toFilenamePart("")).toBe("selection");
  });
});
