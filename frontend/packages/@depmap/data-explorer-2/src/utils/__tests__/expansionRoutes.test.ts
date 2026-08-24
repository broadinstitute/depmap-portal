import { breadboxAPI } from "@depmap/api";
import simplifyVarNames from "../../components/ContextBuilderV2/utils/simplifyVarNames";
import {
  fromParentContext,
  getExpansionRoutes,
  getRouteHeading,
  getRouteNouns,
  resolveParentLabel,
  toParentContext,
} from "../expansionRoutes";

// The reference this file exists to protect: the context Transcript Explorer
// has hand-written since the expansion feature shipped, with "transcript",
// "transcript_metadata" and "Gene" hardcoded (see `makeSetExpansionAction` in
// portal-frontend's transcriptExplorer/components/utils.ts). The generic path
// must produce exactly this, or replacing the hardcoded version is a
// regression rather than a cleanup.
//
// One deliberate difference: the variable is "0" where the hand-written
// version called it "gene". Context Builder's `simplifyVarNames` renumbers
// variables from zero when it saves, so matching that convention is what keeps
// a generated context and a builder-saved one hashing alike instead of
// accumulating duplicates. Everything the context MEANS is unchanged —
// variable names are internal to the expression.
const TRANSCRIPT_EXPLORER_CONTEXT = {
  dimension_type: "transcript",
  expr: { "==": [{ var: "0" }, "CD44"] },
  vars: {
    0: {
      dataset_id: "transcript_metadata",
      identifier: "Gene",
      identifier_type: "column",
      source: "property",
    },
  },
};

beforeEach(() => {
  // `metadata_dataset_id` is Breadbox's internal dataset id — a version-pinned
  // UUID, NOT the given_id. Mocking it as a friendly string would let a
  // generated context embed the UUID and still look correct here.
  breadboxAPI.getDatasets = jest
    .fn<ReturnType<typeof breadboxAPI.getDatasets>, []>()
    .mockResolvedValue([
      { id: "uuid-transcript-meta", given_id: "transcript_metadata" },
      { id: "uuid-gene-meta", given_id: "gene_metadata" },
      { id: "uuid-compound-dose-meta", given_id: "compound_dose_metadata" },
      { id: "uuid-compound-meta", given_id: "compound_v2_metadata" },
      { id: "uuid-antibody-meta", given_id: "antibody_v2_metadata" },
      // A dataset with no given_id, to prove the fallback.
      { id: "uuid-no-given-id", given_id: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

  breadboxAPI.getDimensionTypes = jest
    .fn<ReturnType<typeof breadboxAPI.getDimensionTypes>, []>()
    .mockResolvedValue([
      {
        name: "transcript",
        display_name: "Transcript",
        id_column: "transcript_id",
        axis: "feature",
        metadata_dataset_id: "uuid-transcript-meta",
        properties_to_index: [],
      },
      {
        name: "gene",
        display_name: "Gene",
        id_column: "entrez_id",
        axis: "feature",
        metadata_dataset_id: "uuid-gene-meta",
        properties_to_index: [],
      },
      {
        name: "compound_dose",
        display_name: "Compound Dose",
        id_column: "compound_dose_id",
        axis: "feature",
        metadata_dataset_id: "uuid-compound-dose-meta",
        properties_to_index: [],
      },
      {
        name: "compound_v2",
        display_name: "Compound",
        id_column: "compound_id",
        axis: "feature",
        metadata_dataset_id: "uuid-compound-meta",
        properties_to_index: [],
      },
      {
        name: "antibody_v2",
        display_name: "Antibody",
        id_column: "antibody_id",
        axis: "feature",
        metadata_dataset_id: "uuid-antibody-meta",
        properties_to_index: [],
      },
      // A type with no declared route.
      {
        name: "depmap_model",
        display_name: "Cell Line",
        id_column: "depmap_id",
        axis: "sample",
        metadata_dataset_id: "uuid-no-given-id",
        properties_to_index: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

  breadboxAPI.getDimensionTypeIdentifiers = jest
    .fn<ReturnType<typeof breadboxAPI.getDimensionTypeIdentifiers>, []>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue([
      { id: "DPC-000001", label: "afatinib" },
      { id: "DPC-000002", label: "dabrafenib" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
});

describe("getExpansionRoutes", () => {
  it("offers gene for transcripts", () => {
    expect(getExpansionRoutes("transcript")).toEqual([
      { parentType: "gene", column: "Gene", matchOn: "label" },
    ]);
  });

  it("offers nothing for a type with no declared route", () => {
    expect(getExpansionRoutes("depmap_model")).toEqual([]);
    expect(getExpansionRoutes(null)).toEqual([]);
    expect(getExpansionRoutes(undefined)).toEqual([]);
  });

  it("offers compound_v2 for compound doses, matched on id", () => {
    // CompoundID is a real foreign key holding compound_v2 given_ids, unlike
    // transcript_metadata.Gene which holds symbols. Getting this backwards
    // produces a context that matches nothing, with no error.
    expect(getExpansionRoutes("compound_dose")).toEqual([
      {
        parentType: "compound_v2",
        column: "CompoundID",
        matchOn: "id",
        memberNoun: { one: "dose", other: "doses" },
      },
    ]);
  });
});

describe("toParentContext", () => {
  it("reproduces Transcript Explorer's hand-written context", async () => {
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("transcript", route, {
      id: "1234",
      label: "CD44",
    });

    expect(context).toMatchObject(TRANSCRIPT_EXPLORER_CONTEXT);
  });

  it("matches on the label for a label-valued column, ignoring the id", async () => {
    // `transcript_metadata.Gene` holds symbols, so the gene's given_id must
    // NOT end up in the expression — it would match nothing.
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("transcript", route, {
      id: "1234",
      label: "CD44",
    });

    expect((context!.expr as { "==": [unknown, string] })["=="][1]).toBe(
      "CD44"
    );
  });

  it("names the context for what it contains, not just the parent", async () => {
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("transcript", route, {
      id: "1234",
      label: "CD44",
    });

    expect(context!.name).toBe("CD44 Transcripts");
  });

  it("returns null when the child type has no metadata dataset", async () => {
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("nonexistent_type", route, {
      id: "1234",
      label: "CD44",
    });

    expect(context).toBeNull();
  });

  it("references the metadata dataset by given_id, not its versioned id", async () => {
    // `metadata_dataset_id` is a UUID pinned to one version of the dataset. A
    // generated context gets saved and shared, so it has to follow the latest
    // release rather than freezing whatever was current when it was made.
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("transcript", route, {
      id: "1234",
      label: "CD44",
    });

    expect(context!.vars["0"].dataset_id).toBe("transcript_metadata");
    expect(context!.vars["0"].dataset_id).not.toBe("uuid-transcript-meta");
  });

  it("falls back to the versioned id when a dataset has no given_id", async () => {
    // A pinned reference still beats no reference.
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("depmap_model", route, {
      id: "1234",
      label: "CD44",
    });

    expect(context!.vars["0"].dataset_id).toBe("uuid-no-given-id");
  });

  it("survives Context Builder's normalization unchanged", async () => {
    // The actual invariant behind naming the variable "0": a generated context
    // and the same context after a round trip through the builder have to be
    // byte-identical, or they hash differently and the user accumulates
    // duplicate saved copies of one thing. Compared against the real
    // simplifyVarNames rather than a restatement of it, so this keeps holding
    // if the builder's naming scheme ever changes.
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("transcript", route, {
      id: "1234",
      label: "CD44",
    });

    expect(simplifyVarNames(context!)).toEqual(context);
  });
});

describe("getRouteHeading", () => {
  it("drops the redundant parent word for compound doses", () => {
    // compound_dose's display name is "Compound at dose", which pluralizes
    // into "Compounds At Doses of a compound" — the "Compound" is already
    // carried by the parent. memberNoun overrides it.
    const [route] = getExpansionRoutes("compound_dose");

    expect(getRouteHeading("compound_dose", route)).toBe("Doses of a compound");
  });

  it("uses the dimension type's own name when there is no override", () => {
    const [route] = getExpansionRoutes("transcript");

    expect(getRouteHeading("transcript", route)).toBe("Transcripts of a gene");
  });
});

describe("getRouteNouns", () => {
  // Casing is left alone here and normalized at each use site (the heading
  // capitalizes, the accept text lowercases), so these compare case-insensitively
  // — under jest the dimension-type cache is cold and labels fall back to a
  // munged type name, which differs in case from the real display_name.
  const lower = (nouns: { member: string; members: string }) => ({
    member: nouns.member.toLowerCase(),
    members: nouns.members.toLowerCase(),
  });

  it("uses the route's override where there is one", () => {
    const [route] = getExpansionRoutes("compound_dose");

    expect(lower(getRouteNouns("compound_dose", route))).toEqual({
      member: "dose",
      members: "doses",
    });
  });

  it("falls back to the dimension type's own name otherwise", () => {
    const [route] = getExpansionRoutes("transcript");

    expect(lower(getRouteNouns("transcript", route))).toEqual({
      member: "transcript",
      members: "transcripts",
    });
  });
});

describe("toParentContext for an id-matched route", () => {
  it("matches on the id, ignoring the label the user searched by", async () => {
    // The picker searches compound_v2 by name, so the user types "afatinib" —
    // but CompoundID holds given_ids, so that is what has to land in the
    // expression.
    const [route] = getExpansionRoutes("compound_dose");

    const context = await toParentContext("compound_dose", route, {
      id: "DPC-000001",
      label: "afatinib",
    });

    expect((context!.expr as { "==": [unknown, string] })["=="][1]).toBe(
      "DPC-000001"
    );
    expect(context!.vars["0"]).toMatchObject({
      dataset_id: "compound_dose_metadata",
      identifier: "CompoundID",
      identifier_type: "column",
    });
  });

  it("names the context after the label, using the route's own noun", async () => {
    const [route] = getExpansionRoutes("compound_dose");

    const context = await toParentContext("compound_dose", route, {
      id: "DPC-000001",
      label: "afatinib",
    });

    // Not "afatinib Compound Doses" — the noun override applies here too, so a
    // saved context reads the way the option that made it did.
    expect(context!.name).toBe("afatinib Doses");
  });
});

describe("resolveParentLabel", () => {
  it("turns a recovered id back into the parent's name", async () => {
    const [route] = getExpansionRoutes("compound_dose");

    // What fromParentContext can recover on its own: the id, twice over.
    const resolved = await resolveParentLabel(route, {
      id: "DPC-000001",
      label: "DPC-000001",
    });

    expect(resolved).toEqual({ id: "DPC-000001", label: "afatinib" });
  });

  it("leaves a label-matched route alone without a lookup", async () => {
    const [route] = getExpansionRoutes("transcript");

    const resolved = await resolveParentLabel(route, {
      id: "CD44",
      label: "CD44",
    });

    expect(resolved).toEqual({ id: "CD44", label: "CD44" });
    expect(breadboxAPI.getDimensionTypeIdentifiers).not.toHaveBeenCalled();
  });

  it("falls back to the selection when the id is no longer known", async () => {
    const [route] = getExpansionRoutes("compound_dose");

    const resolved = await resolveParentLabel(route, {
      id: "DPC-999999",
      label: "DPC-999999",
    });

    expect(resolved).toEqual({ id: "DPC-999999", label: "DPC-999999" });
  });
});

describe("fromParentContext", () => {
  it("round-trips a context this module generated", async () => {
    const [route] = getExpansionRoutes("transcript");

    const context = await toParentContext("transcript", route, {
      id: "1234",
      label: "CD44",
    });

    expect(fromParentContext(context, route)).toEqual({
      id: "CD44",
      label: "CD44",
    });
  });

  it("declines a context that isn't a parent pick", () => {
    const [route] = getExpansionRoutes("transcript");

    // "All" — perfectly valid, just not ours.
    expect(
      fromParentContext(
        {
          name: "All",
          dimension_type: "transcript",
          expr: true,
          vars: {},
        },
        route
      )
    ).toBeNull();

    // An equality on a different column.
    expect(
      fromParentContext(
        {
          name: "Something else",
          dimension_type: "transcript",
          expr: { "==": [{ var: "x" }, "CD44"] },
          vars: {
            x: {
              dataset_id: "transcript_metadata",
              identifier: "SomeOtherColumn",
              identifier_type: "column",
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        route
      )
    ).toBeNull();

    expect(fromParentContext(null, route)).toBeNull();
  });
});

// The route that isn't parenthood: many genes can encode one protein, so an
// antibody names several through `target_entrez_id`. That forces two departures
// from every other route — the value is reached by reindexing rather than read
// off the child's own metadata, and membership is `has_any` over a list rather
// than `==` against a scalar.
describe("antibody_v2 route", () => {
  const [route] = getExpansionRoutes("antibody_v2");

  it("reads the gene's label through the antibody's foreign key", async () => {
    const context = await toParentContext("antibody_v2", route, {
      id: "207",
      label: "AKT1",
    });

    expect(context).toEqual({
      name: "AKT1 Antibodies",
      dimension_type: "antibody_v2",
      expr: { has_any: [{ var: "0" }, ["AKT1"]] },
      vars: {
        0: {
          // The PARENT's metadata, because that is where the symbol lives...
          dataset_id: "gene_metadata",
          identifier: "label",
          identifier_type: "column",
          // ...reached through the child's reference to it.
          reindex_through: {
            dataset_id: "antibody_v2_metadata",
            identifier: "target_entrez_id",
            identifier_type: "column",
          },
          source: "property",
        },
      },
    });
  });

  it("matches the symbol, not the id the column holds", async () => {
    // target_entrez_id holds "207"; comparing against it would need the user to
    // know the entrez id, and would save a context nobody can read. The reindex
    // exists precisely so the expression can carry "AKT1".
    const context = await toParentContext("antibody_v2", route, {
      id: "207",
      label: "AKT1",
    });

    expect(JSON.stringify(context)).not.toContain("207");
  });

  it("round-trips through fromParentContext", async () => {
    const context = await toParentContext("antibody_v2", route, {
      id: "207",
      label: "AKT1",
    });

    expect(fromParentContext(context, route)).toEqual({
      id: "AKT1",
      label: "AKT1",
    });
  });

  it("survives the renumbering Context Builder applies on save", async () => {
    const context = await toParentContext("antibody_v2", route, {
      id: "207",
      label: "AKT1",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = simplifyVarNames(context as any);

    expect(saved).toEqual(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(fromParentContext(saved as any, route)).toEqual({
      id: "AKT1",
      label: "AKT1",
    });
  });

  it("declines a context that only looks like one of ours", () => {
    // Right operator and right columns, but several values — a hand-built
    // context asking for antibodies against any of three genes. Reporting one
    // of them as "the selection" would misrepresent it.
    expect(
      fromParentContext(
        {
          name: "Several genes",
          dimension_type: "antibody_v2",
          expr: { has_any: [{ var: "0" }, ["AKT1", "AKT2", "AKT3"]] },
          vars: {
            0: {
              dataset_id: "gene_metadata",
              identifier: "label",
              identifier_type: "column",
              reindex_through: {
                dataset_id: "antibody_v2_metadata",
                identifier: "target_entrez_id",
                identifier_type: "column",
              },
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        route
      )
    ).toBeNull();

    // Right shape, but read straight off the antibody's own metadata with no
    // reindex — so it is comparing a symbol against a column of ids.
    expect(
      fromParentContext(
        {
          name: "No reindex",
          dimension_type: "antibody_v2",
          expr: { has_any: [{ var: "0" }, ["AKT1"]] },
          vars: {
            0: {
              dataset_id: "antibody_v2_metadata",
              identifier: "target_entrez_id",
              identifier_type: "column",
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        route
      )
    ).toBeNull();
  });

  it("needs no noun override to read properly", () => {
    // "Antibody" pluralizes cleanly and the parent word isn't already carried,
    // so unlike compound_dose this route wants no memberNoun. Casing compared
    // loosely for the reason the getRouteNouns block below explains: the
    // dimension-type cache is cold under jest.
    expect(getRouteHeading("antibody_v2", route)).toBe("Antibodies of a gene");

    const nouns = getRouteNouns("antibody_v2", route);
    expect(nouns.members.toLowerCase()).toBe("antibodies");
    expect(nouns.parent.toLowerCase()).toBe("gene");
  });
});
