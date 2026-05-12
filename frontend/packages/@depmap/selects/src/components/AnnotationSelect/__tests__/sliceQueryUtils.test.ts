import { SliceQuery } from "@depmap/types";
import { buildSliceQuery, deriveNavStateFromValue } from "../sliceQueryUtils";
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
