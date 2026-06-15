import { useEffect, useState } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { fetchDatasetIdentifiers } from "@depmap/data-explorer-2/src/services/dataExplorerAPI/identifiers";

// useAvailableTranscriptIds
//
// Returns the set of feature ids the expansion's dataset actually measures, so
// callers can tell which transcripts have data — vs. ones that exist in
// transcript_metadata (and so appear in the expansion context) but are missing
// from the chosen dataset. Returns null while the fetch is in flight or before
// an expansion is configured; callers should treat null as "not yet known"
// (i.e. optimistically available) rather than "nothing available".
//
// Inputs are resolved from the plot the way the rest of the expansion code
// does: dataset_id lives on the expansion *dimension* (the select_expansion
// reducer relocates it there), while slice_type lives on expand_by.
export default function useAvailableTranscriptIds(
  plot: PartialDataExplorerPlotConfig,
  expansionAxis: "x" | "y"
): Set<string> | null {
  const datasetId = plot.dimensions?.[expansionAxis]?.dataset_id ?? null;
  const sliceType = plot.expand_by?.[0]?.slice_type ?? null;

  const [availableIds, setAvailableIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAvailableIds(null);

    if (datasetId && sliceType) {
      fetchDatasetIdentifiers(sliceType, datasetId).then((features) => {
        if (!cancelled) {
          setAvailableIds(new Set(features.map((f) => f.id)));
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [datasetId, sliceType]);

  return availableIds;
}
