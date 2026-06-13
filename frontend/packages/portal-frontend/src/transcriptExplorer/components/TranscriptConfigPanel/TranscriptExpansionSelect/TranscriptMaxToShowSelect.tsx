import React from "react";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import { MAX_EXPANSION_MEMBERS } from "@depmap/data-explorer-2/src/services/dataExplorerAPI/expandedPlot";

interface Props {
  show: boolean;
  value: number;
  onChange: (nextLimit: number) => void;
}

// Curated page-size choices, capped at the hard ceiling so the dropdown can
// never offer more than the fetcher will materialize.
const PAGE_SIZE_CHOICES = [6, 9, 12, 16];

function TranscriptMaxToShowSelect({ show, value, onChange }: Props) {
  const options: Record<string, string> = {};

  PAGE_SIZE_CHOICES.filter((n) => n <= MAX_EXPANSION_MEMBERS).forEach((n) => {
    options[String(n)] = String(n);
  });

  return (
    <PlotConfigSelect
      show={show}
      enable
      label="Max transcripts to show"
      placeholder="Choose…"
      options={options}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
    />
  );
}

export default TranscriptMaxToShowSelect;
