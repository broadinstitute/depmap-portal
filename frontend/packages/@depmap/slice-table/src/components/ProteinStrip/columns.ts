import type { SliceQuery } from "@depmap/types";
import { HYDROPHOBICITY_SCALE, StripScale, TOPOLOGY_SCALE } from "./scales";

// Which columns hold one character per residue, and how to color each.
//
// An explicit list keyed on the slice query, rather than something inferred
// from the data. The alternative -- sniffing the values for long strings drawn
// from a small alphabet -- would have to guess, and would guess wrong on any
// other column of long text. These identifiers are stable, so a lookup is both
// simpler and more accurate than anything derived.
//
// Adding a column is one entry here and nothing else: every SliceTable in the
// portal and in Elara picks it up, because the lookup happens where the column
// definitions are built rather than in any one consumer.
const PROTEIN_STRIP_COLUMNS: {
  dataset_id: string;
  identifier: string;
  scale: StripScale;
}[] = [
  {
    dataset_id: "transcriptome_domain_annotation_merged_annotations",
    identifier: "topology",
    scale: TOPOLOGY_SCALE,
  },
  {
    dataset_id: "transcriptome_domain_annotation_merged_annotations",
    identifier: "sequence",
    scale: HYDROPHOBICITY_SCALE,
  },
];

// The scale for a slice, or null if it isn't a per-residue column.
//
// `identifier_type` is part of the match because these are tabular columns; the
// same strings addressed as feature or sample IDs would mean something else
// entirely.
export default function getProteinStripScale(
  slice: SliceQuery
): StripScale | null {
  const match = PROTEIN_STRIP_COLUMNS.find(
    (column) =>
      column.dataset_id === slice.dataset_id &&
      column.identifier === slice.identifier &&
      slice.identifier_type === "column"
  );

  return match ? match.scale : null;
}
