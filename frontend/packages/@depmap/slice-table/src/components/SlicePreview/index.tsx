import React, { useMemo } from "react";
import { Spinner } from "@depmap/common-components";
import {
  PlotlyLoaderProvider,
  useDataExplorerSettings,
} from "@depmap/data-explorer-2";
import type { SliceQuery } from "@depmap/types";
import useData, { createUniqueColumnKey } from "../useData";
import CategoricalDataPreview from "./CategoricalDataPreview";
import ContinuousDataPreview from "./ContinuousDataPreview";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  index_type_name: string;
  value: SliceQuery | null;
  PlotlyLoader: any;
}

function SlicePreview({ index_type_name, value, PlotlyLoader }: Props) {
  const { plotStyles } = useDataExplorerSettings();

  const slices = useMemo(() => (value ? [value] : []), [value]);
  const {
    error,
    loading,
    data: previewData,
    columns: previewColumns,
  } = useData({
    index_type_name,
    slices,
  });
  const uniqueId = value ? createUniqueColumnKey(value) : "";
  const column = previewColumns.find(({ id }) => id === uniqueId);

  if (error) {
    return <div>An unexpected error occurred.</div>;
  }

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div>
          <Spinner position="static" />
        </div>
      </div>
    );
  }

  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      {!value && (
        <div className={styles.previewPlaceholder}>
          <i>a data preview will appear here</i>
        </div>
      )}
      {column && column.meta.value_type !== "continuous" && (
        <CategoricalDataPreview
          value={value}
          data={previewData}
          uniqueId={uniqueId}
        />
      )}
      {column && column.meta.value_type === "continuous" && (
        <ContinuousDataPreview
          slice={value}
          data={previewData}
          column={column}
          plotStyles={plotStyles}
          uniqueId={uniqueId}
        />
      )}
    </PlotlyLoaderProvider>
  );
}

export default SlicePreview;
