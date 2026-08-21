import { DataExplorerExpansion, DataExplorerPlotResponse } from "@depmap/types";

// What to call the two halves of a selected point, in whatever plot produced
// it. An expansion is depmap_model × transcript in Transcript Explorer and
// something else everywhere else, so the panel that lists these pairs can't
// name either half itself — it used to, and read "Model"/"Transcript" over
// compounds and doses.
export interface PairLabels {
  index: string;
  member: string;
}

// Breadbox's curated display names, by way of the plot response. Both are
// optional there — a response assembled without consulting Breadbox carries
// neither — so the machine-readable type name is the fallback. That reads
// "depmap_model" rather than "Cell Line", which is worse but still names the
// right thing, unlike a hardcoded label that happens to be wrong.
//
// The final constants are unreachable through fetchExpandedPlot (index_type is
// required, and an expansion always carries slice_type) and exist so a
// half-built response can't render an empty column header.
export function resolvePairLabels(
  data: DataExplorerPlotResponse | null,
  expansion: DataExplorerExpansion | undefined
): PairLabels {
  return {
    index: data?.index_display_name || data?.index_type || "Index",
    member: expansion?.display_name || expansion?.slice_type || "Member",
  };
}

// A display name may hold anything — spaces, slashes, parentheses, quotes — so
// it can't go into a download filename as it stands. "Compound at dose"
// becomes "compound_at_dose"; a label with nothing alphanumeric in it at all
// would collapse to the empty string, hence the fallback.
export function toFilenamePart(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "selection"
  );
}
