import React, { useEffect, useState } from "react";
import {
  convertDimensionToSliceQuery,
  DimensionSelectV2,
  isCompleteDimension,
} from "@depmap/data-explorer-2";
import { SliceQuery, DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import convertSliceQueryToDimension from "../../../utils/convertSliceQueryToDimension";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  index_type: string;
  value: SliceQuery | undefined;
  onChange: (nextValue: SliceQuery | undefined) => void;
}

function AnalysisSliceSelect({ index_type, value, onChange }: Props) {
  const [
    dimension,
    setDimension,
  ] = useState<DataExplorerPlotConfigDimensionV2 | null>(null);

  const isDimensionUnititalized = value && dimension === null;

  useEffect(() => {
    (async () => {
      if (isDimensionUnititalized) {
        const nextDimension = await convertSliceQueryToDimension(
          index_type,
          value
        );

        setDimension((prev) => {
          return JSON.stringify(prev) === JSON.stringify(nextDimension)
            ? prev
            : nextDimension;
        });
      }
    })();
  }, [index_type, value, isDimensionUnititalized]);

  if (isDimensionUnititalized) {
    return <div style={{ minHeight: 270 }}>Loading...</div>;
  }

  return (
    <DimensionSelectV2
      className={styles.AnalysisDimensionSelectContainer}
      selectClassName={styles.AnalysisDimensionSelect}
      mode="entity-only"
      index_type={index_type}
      allowNullFeatureType
      value={dimension}
      onChange={async (nextDimension) => {
        if (isCompleteDimension(nextDimension)) {
          const sliceQuery = await convertDimensionToSliceQuery(nextDimension);
          // Wait for this to finish before triggering `onChange`
          // (prevents a weird reflow).
          await convertSliceQueryToDimension(index_type, sliceQuery);
          onChange(sliceQuery);
        } else {
          onChange(undefined);
        }
      }}
    />
  );
}

export default AnalysisSliceSelect;
