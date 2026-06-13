import React, { useEffect, useRef, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import { ColorByValue, DataExplorerPlotConfig } from "@depmap/types";
import { getDimensionTypeLabel } from "@depmap/data-explorer-2/src/utils/misc";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  enable: boolean;
  value: string | null;
  index_type: string;
  onChange: (nextValue: DataExplorerPlotConfig["color_by"]) => void;
}

function TranscriptColorByTypeSelect({
  enable,
  value,
  index_type,
  onChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [indexTypeLabel, setSliceTypeLabel] = useState(
    getDimensionTypeLabel(index_type)
  );
  useEffect(() => {
    (async () => {
      cached(breadboxAPI)
        .getDimensionTypes()
        .then(() => {
          setTimeout(() => {
            setSliceTypeLabel(getDimensionTypeLabel(index_type));
          });
        });
    })();
  }, [index_type]);

  const options: Partial<Record<ColorByValue, string>> = {
    raw_slice: indexTypeLabel,
  };

  options.aggregated_slice = `${indexTypeLabel} Context`;
  options.property = `${indexTypeLabel} Annotation`;
  options.custom = "Dataset";
  options.expansion = "Transcript";

  return (
    <div ref={ref} className={styles.colorBySelector}>
      <PlotConfigSelect
        show
        isClearable
        label="Color by"
        placeholder="Choose type…"
        options={options}
        enable={enable}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue as DataExplorerPlotConfig["color_by"]);

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

export default TranscriptColorByTypeSelect;
