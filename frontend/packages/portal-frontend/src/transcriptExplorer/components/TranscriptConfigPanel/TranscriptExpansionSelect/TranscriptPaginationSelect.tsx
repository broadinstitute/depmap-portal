import React from "react";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import { DataExplorerContextV2 } from "@depmap/types";
import HelpTip from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/HelpTip";
import useContextResult from "../useContextResult";

interface Props {
  context?: DataExplorerContextV2 | null;
  offset: number;
  pageSize: number;
  onChange: (nextOffset: number) => void;
}

// Interim pagination: walk the gene's full transcript set (resolved from the
// expansion context) in page-aligned windows of `pageSize`. The options read
// "1 - 9", "10 - 18", …; the selected value also shows the total, e.g.
// "1 - 9 of 40". This is a contiguous-range stopgap that will be retired once
// the user can pick an explicit member subset.
function TranscriptPaginationSelect({
  context = null,
  offset,
  pageSize,
  onChange,
}: Props) {
  const { isLoading, result } = useContextResult(context);
  const total = result?.ids.length || 0;

  const options: { value: string; label: string }[] = [];

  for (let start = 0; start < total; start += pageSize) {
    const end = Math.min(start + pageSize, total);
    let label = `${start + 1} - ${end}`;

    if (start + 1 === end) {
      label = `${end}`;
    }

    options.push({ value: String(start), label });
  }

  const currentStart = Math.min(Math.max(0, offset), total);
  const currentEnd = Math.min(currentStart + pageSize, total);
  let currentLabel = `${currentStart + 1} - ${currentEnd}`;

  if (currentStart + 1 === currentEnd) {
    currentLabel = `${currentEnd}`;
  }

  const displayValue = {
    value: String(currentStart),
    label: `${currentLabel} of ${total}`,
  };

  return (
    <PlotConfigSelect
      show={!isLoading && total > pageSize}
      enable
      label={
        <span>
          Showing transcripts
          <HelpTip id="temp-pagination-help" />
        </span>
      }
      placeholder="Select subset…"
      options={options}
      value={displayValue}
      onChange={(value) => onChange(Number(value))}
    />
  );
}

export default TranscriptPaginationSelect;
