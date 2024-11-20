import React from "react";
import PlotConfigSelect from "../PlotConfigSelect";
import { DataExplorerAggregation } from "@depmap/types";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  show: boolean;
  value: string;
  onChange: (nextValue: DataExplorerAggregation) => void;
}

function AggregationSelect({ show, value, onChange }: Props) {
  if (!show) {
    return null;
  }

  return (
    <div className={styles.aggregation}>
      <PlotConfigSelect
        show
        enable
        inlineLabel
        label="Method"
        placeholder="Choose a method…"
        options={{
          mean: "Mean",
          median: "Median",
          "25%tile": "25%tile",
          "75%tile": "75%tile",
        }}
        value={value}
        onChange={(nextValue) => onChange(nextValue as DataExplorerAggregation)}
      />
    </div>
  );
}

export default AggregationSelect;
