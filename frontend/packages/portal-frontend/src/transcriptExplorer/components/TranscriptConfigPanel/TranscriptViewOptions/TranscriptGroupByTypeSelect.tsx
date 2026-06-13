import React, { useRef } from "react";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import { ColorByValue, DataExplorerPlotConfig } from "@depmap/types";
import styles from "../../../styles/TranscriptPlotConfig.scss";

// `group_by` currently reuses ColorByValue. The honest answer to the old
// "are they the same?" question is no: the renderers only honor a subset of
// these values as a distinct grouping (today just "expansion"), so a narrower
// GroupByValue in @depmap/types is the right model. That's deferred along with
// the rest of the independent group axis (see DEFERRED-GROUP-BY-MODES below);
// until then this alias keeps the one wired value type-checking.
type GroupByValue = ColorByValue;

interface Props {
  enable: boolean;
  value: string | null;
  onChange: (nextValue: DataExplorerPlotConfig["group_by"] | null) => void;
}

function TranscriptGroupByTypeSelect({ enable, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // HACK (DEFERRED-GROUP-BY-MODES): "expansion" (Transcript) is the only
  // wired group_by value — the renderers special-case it
  // (findCategoricalSlice reads data.expansions[0]) and the fetcher attaches
  // it. The other color_by-shaped modes
  // (raw_slice/aggregated_slice/property/custom) need an independent group
  // source plumbed through the fetcher + findCategoricalSlice plus a group
  // dimension/filters/metadata — a full mirror of color_by — and are
  // deferred. The select is clearable: clearing unsets group_by, which (via
  // the existing `group_by ?? color_by` coupling) groups by color_by in the
  // 1D plots and ungroups entirely in scatter.
  const options: Partial<Record<GroupByValue, string>> = {
    expansion: "Transcript",
  };

  return (
    <div ref={ref} className={styles.colorBySelector}>
      <PlotConfigSelect
        show
        isClearable
        label="Group by"
        placeholder="Choose type…"
        options={options}
        enable={enable}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue as DataExplorerPlotConfig["group_by"] | null);

          setTimeout(() => {
            ref.current?.parentElement?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 0);
        }}
      />
    </div>
  );
}

export default TranscriptGroupByTypeSelect;
