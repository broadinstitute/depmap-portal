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

  it("surfaces a distinct 'label' column at every level of an auto-traversed chain", () => {
    // "label" is a reserved column present on every dim type's own metadata
    // table (not a single global column), so peptide → protein → gene should
    // each contribute their own "label" entry, distinguishable by tableId
    // and autoPath (not just column name).
    const result = computeLevel(
      "peptide",
      "peptide",
      TABLES_BY_DIM,
      DIM_TYPES,
      new Set()
    );

    const labelEntries = result.columns.filter((c) => c.columnName === "label");
    expect(labelEntries).toHaveLength(3);

    const peptideLabel = labelEntries.find(
      (c) => c.tableId === "peptide_metadata_id"
    );
    expect(peptideLabel?.autoPath).toEqual([]);

    const proteinLabel = labelEntries.find(
      (c) => c.tableId === "protein_metadata_id"
    );
    expect(proteinLabel?.autoPath).toEqual([
      { throughCol: "protein_fk", toDim: "protein" },
    ]);

    const geneLabel = labelEntries.find(
      (c) => c.tableId === "gene_metadata_id"
    );
    expect(geneLabel?.autoPath).toEqual([
      { throughCol: "protein_fk", toDim: "protein" },
      { throughCol: "gene_fk", toDim: "gene" },
    ]);
  });
});

const tbl = (
  id: string,
  columns: Record<string, string | null>
): TableDescriptor =>
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

const dim = (name: string): DimensionTypeDescriptor =>
  ({
    name,
    display_name: name,
    id_column: "id",
    axis: "sample",
    metadata_dataset_id: `${name}_md`,
  } as any);

const ROUTE_DIM_TYPES: Record<string, DimensionTypeDescriptor> = {
  screen: dim("screen"),
  model_condition: dim("model_condition"),
  depmap_model: dim("depmap_model"),
};

const ROUTE_LEAF_TABLES = {
  model_condition: [tbl("model_condition_md", { ModelID: "depmap_model" })],
  depmap_model: [tbl("depmap_model_md", { lineage: null })],
};

describe("computeLevel route choice", () => {
  const run = (screenCols: Record<string, string | null>) =>
    computeLevel(
      "screen",
      "screen",
      { screen: [tbl("screen_md", screenCols)], ...ROUTE_LEAF_TABLES },
      ROUTE_DIM_TYPES,
      new Set()
    );

  const lineagePath = (result: ReturnType<typeof computeLevel>) =>
    result.columns.find((c) => c.columnName === "lineage")?.autoPath;

  const VIA_CONDITION = [
    { throughCol: "ModelConditionID", toDim: "model_condition" },
    { throughCol: "ModelID", toDim: "depmap_model" },
  ];

  it("treats the direct ModelID as a shortcut when ModelID is declared first", () => {
    const result = run({
      ModelID: "depmap_model",
      ModelConditionID: "model_condition",
    });

    expect(lineagePath(result)).toEqual(VIA_CONDITION);
  });

  it("treats the direct ModelID as a shortcut when ModelConditionID is declared first", () => {
    const result = run({
      ModelConditionID: "model_condition",
      ModelID: "depmap_model",
    });

    expect(lineagePath(result)).toEqual(VIA_CONDITION);
    expect(
      result.columns.filter((c) => c.tableId === "depmap_model_md")
    ).toHaveLength(1);
  });

  it("keeps the direct route when nothing else reaches the target", () => {
    const result = run({ ModelID: "depmap_model" });

    expect(lineagePath(result)).toEqual([
      { throughCol: "ModelID", toDim: "depmap_model" },
    ]);
  });

  it("does not drop either FK when two dims reference each other", () => {
    const tables = {
      start: [tbl("start_md", { to_a: "a", to_b: "b" })],
      a: [tbl("a_md", { to_b: "b" })],
      b: [tbl("b_md", { to_a: "a" })],
    };
    const dims = { start: dim("start"), a: dim("a"), b: dim("b") };
    const result = computeLevel("start", "start", tables, dims, new Set());
    const dimsReached = new Set(result.columns.map((c) => c.dimType));

    expect(dimsReached).toEqual(new Set(["start", "a", "b"]));
  });

  it("breaks equal-length ties alphabetically by FK column name", () => {
    const tables = {
      start: [tbl("start_md", { zz: "mid_a", aa: "mid_b" })],
      mid_a: [tbl("mid_a_md", { to_end: "end" })],
      mid_b: [tbl("mid_b_md", { to_end: "end" })],
      end: [tbl("end_md", { v: null })],
    };
    const dims = {
      start: dim("start"),
      mid_a: dim("mid_a"),
      mid_b: dim("mid_b"),
      end: dim("end"),
    };
    const result = computeLevel("start", "start", tables, dims, new Set());

    expect(result.columns.find((c) => c.dimType === "end")?.autoPath).toEqual([
      { throughCol: "aa", toDim: "mid_b" },
      { throughCol: "to_end", toDim: "end" },
    ]);
  });
});
