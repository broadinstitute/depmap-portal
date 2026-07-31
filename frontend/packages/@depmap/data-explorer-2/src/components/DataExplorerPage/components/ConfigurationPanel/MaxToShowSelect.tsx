import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import PlotConfigSelect from "../../../PlotConfigSelect";
import { MAX_EXPANSION_MEMBERS } from "../../../../services/dataExplorerAPI/expandedPlot";
import { getDimensionTypeLabel, pluralize } from "../../../../utils/misc";

interface Props {
  show: boolean;
  value: number;
  // The slice_type of the current expansion (plot.expand_by?.[0]?.slice_type)
  // — labels this control with its real dimension type instead of a
  // hardcoded "Transcripts". Falls back to "Transcript" when the label
  // hasn't resolved yet, or when this is unset.
  slice_type?: string | null;
  onChange: (nextLimit: number) => void;
}

// Curated page-size choices, capped at the hard ceiling so the dropdown can
// never offer more than the fetcher will materialize.
const PAGE_SIZE_CHOICES = [6, 9, 12, 16];

function MaxToShowSelect({ show, value, slice_type = null, onChange }: Props) {
  const [sliceTypeLabel, setSliceTypeLabel] = useState(
    getDimensionTypeLabel(slice_type ?? undefined)
  );

  useEffect(() => {
    (async () => {
      cached(breadboxAPI)
        .getDimensionTypes()
        .then(() => {
          setTimeout(() => {
            setSliceTypeLabel(getDimensionTypeLabel(slice_type ?? undefined));
          });
        });
    })();
  }, [slice_type]);

  const options: Record<string, string> = {};

  PAGE_SIZE_CHOICES.filter((n) => n <= MAX_EXPANSION_MEMBERS).forEach((n) => {
    options[String(n)] = String(n);
  });

  return (
    <PlotConfigSelect
      show={show}
      enable
      label={`Max ${pluralize(sliceTypeLabel || "Transcript")} to show`}
      placeholder="Choose…"
      options={options}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
    />
  );
}

export default MaxToShowSelect;
