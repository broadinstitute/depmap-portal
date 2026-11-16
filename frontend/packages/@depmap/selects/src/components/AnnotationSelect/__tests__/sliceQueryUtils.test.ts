import { SliceQuery } from "@depmap/types";
import {
  buildSliceQuery,
  checkValueResolves,
  deriveNavStateFromValue,
} from "../sliceQueryUtils";
import computeLevel from "../computeLevel";
import type { DimensionTypeDescriptor, TableDescriptor } from "../types";

const DIM_TYPES: Record<string, DimensionTypeDescriptor> = {
  gene: {
    name: "gene",
    display_name: "Gene",
    id_column: "entrez_id",
    axis: "feature",
    metadata_dataset_id: "gene_metadata_id",
  },
  antibody: {
    name: "antibody",
    display_name: "Antibody",
    id_column: "antibody_id",
    axis: "feature",
    metadata_dataset_id: "antibody_metadata_id",
  },
  screen: {
    name: "screen",
    display_name: "Screen",
    id_column: "screen_id",
    axis: "sample",
    metadata_dataset_id: "screen_metadata_id",
  },
  screen_pair: {
    name: "screen_pair",
    display_name: "Screen Pair",
    id_column: "pair_id",
    axis: "sample",
    metadata_dataset_id: "screen_pair_metadata_id",
  },
};

// Schema:
//   gene_metadata (primary on gene), uniprot_annotations (supplemental on gene)
//   antibody_metadata: target_gene_fk → gene
//   screen_metadata: gene_fk → gene
//   screen_pair_metadata: anchor_screen_id → screen, resistance_screen_id → screen
const TABLES_BY_DIM: Record<string, TableDescriptor[]> = {
  gene: [
    {
      id: "gene_metadata_id",
      given_id: "gene_metadata",
      name: "Gene Metadata",
      columns: {
        label: { col_type: "label" },
        symbol: { col_type: "text" },
      } as any,
    },
    {
      id: "uniprot_id",
      given_id: "uniprot_annotations",
      name: "Uniprot Gene Annotations",
      columns: {
        label: { col_type: "label" },
        keywords: { col_type: "list_strings" },
        localization: { col_type: "list_strings" },
      } as any,
    },
  ],
  antibody: [
    {
      id: "antibody_metadata_id",
      given_id: "antibody_metadata",
      name: "Antibody Metadata",
      columns: {
        label: { col_type: "label" },
        target_gene_fk: { col_type: "text", references: "gene" },
      } as any,
    },
  ],
  screen: [
    {
      id: "screen_metadata_id",
      given_id: "screen_metadata",
      name: "Screen Metadata",
      columns: {
        label: { col_type: "label" },
        gene_fk: { col_type: "text", references: "gene" },
      } as any,
    },
  ],
  screen_pair: [
    {
      id: "screen_pair_metadata_id",
      given_id: "screen_pair_metadata",
      name: "Screen Pair Metadata",
      columns: {
        label: { col_type: "label" },
        anchor_screen_id: { col_type: "text", references: "screen" },
        resistance_screen_id: { col_type: "text", references: "screen" },
      } as any,
    },
  ],
};

const ANTIBODY_SOURCE = {
  id: "antibody_metadata_id",
  given_id: "antibody_metadata",
};
const GENE_SOURCE = {
  id: "gene_metadata_id",
  given_id: "gene_metadata",
};
const SCREEN_PAIR_SOURCE = {
  id: "screen_pair_metadata_id",
  given_id: "screen_pair_metadata",
};

describe("buildSliceQuery", () => {
  it("produces a flat SliceQuery for a same-dim supplemental column", () => {
    // index_type = gene, source = gene_metadata. User clicks "Continue to
    // table" into uniprot_annotations and picks "keywords". No FKs traversed.
    const result = buildSliceQuery(
      "keywords",
      null,
      [],
      {
        tableId: "uniprot_id",
        dimType: "gene",
        autoPath: [],
      },
      GENE_SOURCE,
      "gene",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    expect(result).toEqual({
      dataset_id: "uniprot_annotations",
      identifier: "keywords",
      identifier_type: "column",
    });
  });

  it("wraps an auto-traversed supplemental column in reindex_through", () => {
    // Regression case. index_type = antibody. Auto-traversal via
    // target_gene_fk → gene reaches the uniprot supplemental.
    const result = buildSliceQuery(
      "keywords",
      null,
      [],
      {
        tableId: "uniprot_id",
        dimType: "gene",
        autoPath: [{ throughCol: "target_gene_fk", toDim: "gene" }],
      },
      ANTIBODY_SOURCE,
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    expect(result).toEqual({
      dataset_id: "uniprot_annotations",
      identifier: "keywords",
      identifier_type: "column",
      reindex_through: {
        dataset_id: "antibody_metadata",
        identifier: "target_gene_fk",
        identifier_type: "column",
      },
    });
  });

  it("chains a door hop, an auto-traversal, and a supplemental into a 3-step nested query", () => {
    // index_type = screen_pair. User clicks the anchor_screen_id door
    // (screen_pair → screen), then auto-traverse via gene_fk → gene reaches
    // the uniprot supplemental.
    const result = buildSliceQuery(
      "keywords",
      null,
      [{ throughCol: "anchor_screen_id", toDim: "screen" }],
      {
        tableId: "uniprot_id",
        dimType: "gene",
        autoPath: [{ throughCol: "gene_fk", toDim: "gene" }],
      },
      SCREEN_PAIR_SOURCE,
      "screen_pair",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    expect(result).toEqual({
      dataset_id: "uniprot_annotations",
      identifier: "keywords",
      identifier_type: "column",
      reindex_through: {
        dataset_id: "screen_metadata",
        identifier: "gene_fk",
        identifier_type: "column",
        reindex_through: {
          dataset_id: "screen_pair_metadata",
          identifier: "anchor_screen_id",
          identifier_type: "column",
        },
      },
    });
  });
});

describe("deriveNavStateFromValue", () => {
  it("reconstructs autoPath on the supplemental for an auto-traversed slice", () => {
    const query: SliceQuery = {
      dataset_id: "uniprot_annotations",
      identifier: "keywords",
      identifier_type: "column",
      reindex_through: {
        dataset_id: "antibody_metadata",
        identifier: "target_gene_fk",
        identifier_type: "column",
      },
    };

    const nav = deriveNavStateFromValue(
      query,
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    expect(nav.hops).toEqual([]);
    expect(nav.supplementalTable).toEqual({
      tableId: "uniprot_id",
      tableName: "Uniprot Gene Annotations",
      dimType: "gene",
      dimDisplayName: "Gene",
      autoPath: [{ throughCol: "target_gene_fk", toDim: "gene" }],
    });
  });

  it("classifies door hops separately from supplemental autoPath", () => {
    // 3-step chain: door (anchor_screen_id) + auto (gene_fk) + supplemental.
    // anchor_screen_id should land in hops because screen_pair_metadata has
    // two FKs to screen; gene_fk should land in autoPath because
    // screen_metadata has only one FK to gene.
    const query: SliceQuery = {
      dataset_id: "uniprot_annotations",
      identifier: "keywords",
      identifier_type: "column",
      reindex_through: {
        dataset_id: "screen_metadata",
        identifier: "gene_fk",
        identifier_type: "column",
        reindex_through: {
          dataset_id: "screen_pair_metadata",
          identifier: "anchor_screen_id",
          identifier_type: "column",
        },
      },
    };

    const nav = deriveNavStateFromValue(
      query,
      "screen_pair",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    expect(nav.hops).toEqual([
      { throughCol: "anchor_screen_id", toDim: "screen" },
    ]);
    expect(nav.supplementalTable?.autoPath).toEqual([
      { throughCol: "gene_fk", toDim: "gene" },
    ]);
  });
});

describe("buildSliceQuery + deriveNavStateFromValue round-trip", () => {
  it("is idempotent for the auto-traversed supplemental case", () => {
    const initial = buildSliceQuery(
      "keywords",
      null,
      [],
      {
        tableId: "uniprot_id",
        dimType: "gene",
        autoPath: [{ throughCol: "target_gene_fk", toDim: "gene" }],
      },
      ANTIBODY_SOURCE,
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    const nav = deriveNavStateFromValue(
      initial,
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    const rebuilt = buildSliceQuery(
      "keywords",
      null,
      nav.hops,
      nav.supplementalTable
        ? {
            tableId: nav.supplementalTable.tableId,
            dimType: nav.supplementalTable.dimType,
            autoPath: nav.supplementalTable.autoPath,
          }
        : null,
      ANTIBODY_SOURCE,
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES
    );

    expect(rebuilt).toEqual(initial);
  });
});

describe("deriveNavStateFromValue vs computeLevel door counting", () => {
  // A → B (x); B → A twice (p, q). computeLevel ignores B's FKs to A because
  // A is already visited, so it never offers p or q.
  // deriveNavStateFromValue counts every FK in the table, so it treats a
  // value that hops through p as a door.
  const mk = (id: string, columns: Record<string, string | null>) =>
    ({
      id,
      given_id: id,
      name: id,
      columns: Object.fromEntries(
        Object.entries(columns).map(([k, ref]) => [
          k,
          ref ? { col_type: "text", references: ref } : { col_type: "text" },
        ])
      ),
    } as any);
  const d = (name: string) =>
    ({ name, display_name: name, metadata_dataset_id: `${name}_md` } as any);

  const TABLES = {
    a: [mk("a_md", { x: "b", v: null })],
    b: [mk("b_md", { p: "a", q: "a" })],
  };
  const DIMS = { a: d("a"), b: d("b") };

  it("computeLevel offers no door for B's duplicate FKs to an already-visited dim", () => {
    const level = computeLevel("a", "a", TABLES, DIMS, new Set());

    expect(level.doors).toEqual([]);
  });

  it("deriveNavStateFromValue reports a door hop for the same FKs", () => {
    const query: SliceQuery = {
      dataset_id: "a_md",
      identifier: "v",
      identifier_type: "column",
      reindex_through: {
        dataset_id: "b_md",
        identifier: "p",
        identifier_type: "column",
        reindex_through: {
          dataset_id: "a_md",
          identifier: "x",
          identifier_type: "column",
        },
      },
    };
    const nav = deriveNavStateFromValue(query, "a", TABLES, DIMS);

    expect(nav.hops).toEqual([{ throughCol: "p", toDim: "a" }]);
  });
});

describe("checkValueResolves", () => {
  const chain = (
    leafDataset: string,
    leafColumn: string,
    hopDataset?: string,
    hopColumn?: string
  ): SliceQuery => ({
    dataset_id: leafDataset,
    identifier: leafColumn,
    identifier_type: "column",
    ...(hopDataset && {
      reindex_through: {
        dataset_id: hopDataset,
        identifier: hopColumn as string,
        identifier_type: "column",
      },
    }),
  });

  it("accepts a flat column and a one-hop chain", () => {
    expect(
      checkValueResolves(
        chain("antibody_metadata", "label"),
        "antibody",
        TABLES_BY_DIM
      )
    ).toEqual({ resolved: true });

    expect(
      checkValueResolves(
        chain("gene_metadata", "symbol", "antibody_metadata", "target_gene_fk"),
        "antibody",
        TABLES_BY_DIM
      )
    ).toEqual({ resolved: true });
  });

  it("rejects a dataset that is not in the schema", () => {
    const result = checkValueResolves(
      chain("removed_dataset", "symbol", "antibody_metadata", "target_gene_fk"),
      "antibody",
      TABLES_BY_DIM
    );

    expect(result.resolved).toBe(false);
  });

  it("rejects a root table at the wrong index type", () => {
    const result = checkValueResolves(
      chain("gene_metadata", "symbol"),
      "antibody",
      TABLES_BY_DIM
    );

    expect(result.resolved).toBe(false);
  });

  it("rejects a missing column", () => {
    expect(
      checkValueResolves(
        chain("gene_metadata", "gone", "antibody_metadata", "target_gene_fk"),
        "antibody",
        TABLES_BY_DIM
      ).resolved
    ).toBe(false);
  });

  it("rejects an intermediate column that is not a foreign key", () => {
    expect(
      checkValueResolves(
        chain("gene_metadata", "symbol", "antibody_metadata", "label"),
        "antibody",
        TABLES_BY_DIM
      ).resolved
    ).toBe(false);
  });

  it("rejects a hop that lands on a different type than the next table", () => {
    // screen_metadata is not indexed by gene.
    expect(
      checkValueResolves(
        chain(
          "screen_metadata",
          "label",
          "antibody_metadata",
          "target_gene_fk"
        ),
        "antibody",
        TABLES_BY_DIM
      ).resolved
    ).toBe(false);
  });
});
