import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import ChainColumnPicker from "../ChainColumnPicker";
import type { DimensionTypeDescriptor, TableDescriptor } from "../types";
import type { SourceTable } from "../useChainSelectorData";

// Schema: peptide (root) --protein_fk--> protein --gene_fk--> gene.
// Each level has its own "label" column, which is reserved and present on
// every dimension type's metadata table (not one shared global column).
const DIM_TYPES: Record<string, DimensionTypeDescriptor> = {
  peptide: {
    name: "peptide",
    display_name: "Peptide",
    id_column: "peptide_id",
    axis: "feature",
    metadata_dataset_id: "peptide_metadata_id",
  },
  protein: {
    name: "protein",
    display_name: "Protein",
    id_column: "uniprot_id",
    axis: "feature",
    metadata_dataset_id: "protein_metadata_id",
  },
  gene: {
    name: "gene",
    display_name: "Gene",
    id_column: "entrez_id",
    axis: "feature",
    metadata_dataset_id: "gene_metadata_id",
  },
};

const TABLES_BY_DIM: Record<string, TableDescriptor[]> = {
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
  ],
};

const selectedSource: SourceTable = {
  id: "peptide_metadata_id",
  given_id: "peptide_metadata",
  format: "tabular_dataset",
  name: "Peptide Metadata",
  displayName: "Primary Annotations",
  isPrimary: true,
  columnCount: 1,
  fkCount: 1,
  columns: TABLES_BY_DIM.peptide[0].columns,
  sliceType: null,
  identifierType: null,
};

describe("ChainColumnPicker", () => {
  it("resolves each level's 'label' independently instead of collapsing to the root's", () => {
    const onChange = jest.fn();

    render(
      <ChainColumnPicker
        index_type="peptide"
        value={null}
        onChange={onChange}
        tablesByDim={TABLES_BY_DIM}
        dimTypeMap={DIM_TYPES}
        selectedSource={selectedSource}
      />
    );

    fireEvent.click(screen.getByText("Choose annotation…"));

    // peptide, protein, and gene each contribute their own "label" entry,
    // rendered broadest-to-narrowest (fewest hops first).
    const labelRows = screen.getAllByText("label");
    expect(labelRows).toHaveLength(3);

    // Second occurrence is the auto-traversed protein table's own "label",
    // reached one hop deep via protein_fk.
    fireEvent.click(labelRows[1]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset_id: "protein_metadata",
        identifier: "label",
        reindex_through: expect.objectContaining({
          dataset_id: "peptide_metadata",
          identifier: "protein_fk",
        }),
      })
    );
  });

  it("highlights exactly one row as selected when the value is a chained 'label', not every same-named row", () => {
    // The value is protein's own "label" (one hop deep via protein_fk) —
    // structurally distinct from peptide's or gene's "label", even though
    // all three render with the same columnName.
    const value = {
      dataset_id: "protein_metadata",
      identifier: "label",
      identifier_type: "column" as const,
      reindex_through: {
        dataset_id: "peptide_metadata",
        identifier: "protein_fk",
        identifier_type: "column" as const,
      },
    };

    const { container } = render(
      <ChainColumnPicker
        index_type="peptide"
        value={value}
        onChange={jest.fn()}
        tablesByDim={TABLES_BY_DIM}
        dimTypeMap={DIM_TYPES}
        selectedSource={selectedSource}
      />
    );

    // With a value set, the trigger shows the resolved display label
    // ("label") instead of the placeholder — click it to open the dropdown.
    // (This is the only "label" text before opening; once open, a ghost
    // copy of the trigger's value is also rendered, which is why row
    // selection below is asserted via `data-selected` rather than by
    // counting all "label" text nodes.)
    fireEvent.click(screen.getByText("label"));

    const selectedRows = container.querySelectorAll('[data-selected="true"]');
    expect(selectedRows).toHaveLength(1);

    // The selected row is specifically the protein group's "label" — its
    // sibling shows "via protein_fk" (the auto-traversal hop hint).
    expect(selectedRows[0].textContent?.includes("via protein_fk")).toBe(true);
  });
});
