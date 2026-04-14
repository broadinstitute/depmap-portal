import React from "react";
import { AnnotationSelect } from "@depmap/selects";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";
import renderConditionally from "../../../../utils/render-conditionally";
import checkPlottable from "./checkPlottable";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  dimension_type: string;
  value: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
  onConvertToColorContext: (context: DataExplorerContextV2) => void;
}

function ColorByAnnotationSelect({
  dimension_type,
  value,
  onChange,
  onConvertToColorContext,
}: Props) {
  return (
    <AnnotationSelect
      className={styles.ColorByAnnotationSelect}
      index_type={dimension_type}
      // isClearable
      value={value}
      onChange={async (nextValue) => {
        if (nextValue === null) {
          onChange(null);
          return;
        }

        const isPlottable = await checkPlottable({
          sliceQuery: nextValue,
          dimension_type,
          onConvertToColorContext,
        });

        if (isPlottable) {
          onChange(nextValue);
        }
      }}
    />
  );
}

export default renderConditionally(ColorByAnnotationSelect);
