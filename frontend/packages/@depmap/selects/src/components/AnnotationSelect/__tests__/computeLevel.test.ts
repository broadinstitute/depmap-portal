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
  protein: {
    name: "protein",
    display_name: "Protein",
    id_column: "uniprot_id",
    axis: "feature",
    metadata_dataset_id: "protein_metadata_id",
  },
  antibody: {
    name: "antibody",
    display_name: "Antibody",
    id_column: "antibody_id",
    axis: "feature",
    metadata_dataset_id: "antibody_metadata_id",
  },
  peptide: {
    name: "peptide",
    display_name: "Peptide",
    id_column: "peptide_id",
    axis: "feature",
    metadata_dataset_id: "peptide_metadata_id",
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
//   protein_metadata: gene_fk → gene
//   antibody_metadata: target_gene_fk → gene
//   peptide_metadata: protein_fk → protein
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
  protein: [
    {
      id: "protein_metadata_id",
      given_id: "protein_metadata",
      name: "Protein Metadata",
      columns: {
        label: { col_type: "label" },
        gene_fk: { col_type: "text", references: "gene" },
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
  peptide: [
    {
      id: "peptide_metadata_id",
      given_id: "peptide_metadata",
      name: "Peptide Metadata",
      columns: {
        label: { col_type: "label" },
        protein_fk: { col_type: "text", references: "protein" },
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
    {
      id: "screen_extras_id",
      given_id: "screen_extras",
      name: "Screen Extras",
      columns: {
        label: { col_type: "label" },
        annotation: { col_type: "text" },
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

describe("computeLevel", () => {
  it("emits same-dim supplementals with empty autoPath when their dim is not index_type", () => {
    // index_type = antibody (so gene's same-dim supplementals are not
    // redundant with the source picker, which only lists antibody tables).
    const result = computeLevel(
      "gene",
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    expect(result.supplementalTables).toHaveLength(1);
    expect(result.supplementalTables[0].table.given_id).toBe(
      "uniprot_annotations"
    );
    expect(result.supplementalTables[0].autoPath).toEqual([]);
  });

  it("prepends the auto-traversal hop to a supplemental's autoPath", () => {
    // antibody_metadata.target_gene_fk → gene is a single-FK auto-traversal;
    // the supplemental lives at gene, so its autoPath should record the hop.
    const result = computeLevel(
      "antibody",
      "antibody",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    expect(result.supplementalTables).toHaveLength(1);
    const supp = result.supplementalTables[0];
    expect(supp.table.given_id).toBe("uniprot_annotations");
    expect(supp.autoPath).toEqual([
      { throughCol: "target_gene_fk", toDim: "gene" },
    ]);
  });

  it("preserves outer-to-inner order across multi-hop auto-traversals", () => {
    // peptide → protein → gene chain: the supplemental at gene should
    // record both hops in the order they were traversed (peptide→protein
    // first, protein→gene last).
    const result = computeLevel(
      "peptide",
      "peptide",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    expect(result.supplementalTables).toHaveLength(1);
    expect(result.supplementalTables[0].autoPath).toEqual([
      { throughCol: "protein_fk", toDim: "protein" },
      { throughCol: "gene_fk", toDim: "gene" },
    ]);
  });

  it("returns no supplementals when only door (many-to-one) FKs are reachable", () => {
    // screen_pair has two FKs to screen (a door, not auto-traversed), so
    // computeLevel does not recurse and no deeper supplementals surface.
    // screen_pair has no same-dim extras either.
    const result = computeLevel(
      "screen_pair",
      "screen_pair",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    expect(result.supplementalTables).toEqual([]);
    expect(result.doors).toHaveLength(2);
  });

  it("surfaces both same-dim and auto-traversed supplementals from a post-door dim", () => {
    // After the user clicks a door from screen_pair → screen, the next call
    // is computeLevel("screen", "screen_pair", ...). At this level:
    //   - screen_extras is a same-dim supplemental at screen, NOT redundant
    //     with the source picker (which is anchored at index_type=screen_pair),
    //     so it should surface with empty autoPath.
    //   - The screen → gene auto-traversal also surfaces uniprot with the
    //     hop in autoPath.
    const result = computeLevel(
      "screen",
      "screen_pair",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    expect(result.supplementalTables).toHaveLength(2);

    const sameDim = result.supplementalTables.find(
      (s) => s.table.given_id === "screen_extras"
    );
    expect(sameDim).toBeDefined();
    expect(sameDim!.autoPath).toEqual([]);

    const autoTraversed = result.supplementalTables.find(
      (s) => s.table.given_id === "uniprot_annotations"
    );
    expect(autoTraversed).toBeDefined();
    expect(autoTraversed!.autoPath).toEqual([
      { throughCol: "gene_fk", toDim: "gene" },
    ]);
  });

  it("hides same-dim supplementals at index_type to avoid source-picker redundancy", () => {
    // dimType === index_type === gene: gene's supplementals (uniprot) are
    // already in the source picker, so "Continue to table" should not also
    // offer them.
    const result = computeLevel(
      "gene",
      "gene",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    expect(result.supplementalTables).toEqual([]);
  });
});
