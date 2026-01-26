import React from "react";
import cx from "classnames";
import PlotConfigSelect from "../PlotConfigSelect";
import { DataExplorerAggregation } from "@depmap/types";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  show: boolean;
  value: string;
  onChange: (nextValue: DataExplorerAggregation) => void;
  selectClassName?: string;
}

function AggregationSelect({
  show,
  value,
  onChange,
  selectClassName = undefined,
}: Props) {
  if (!show) {
    return null;
  }

  return (
    <div className={styles.aggregation}>
      <PlotConfigSelect
        show
        enable
        inlineLabel
        className={cx(selectClassName, styles.aggregationSelect)}
        label="Method"
        placeholder="Choose a method…"
        options={{
          mean: "Mean",
          median: "Median",
          "25%tile": "25%tile",
          "75%tile": "75%tile",
          stddev: "Standard deviation",
        }}
        value={value}
        onChange={(nextValue) => onChange(nextValue as DataExplorerAggregation)}
      />
    </div>
  );
}

export default AggregationSelect;
