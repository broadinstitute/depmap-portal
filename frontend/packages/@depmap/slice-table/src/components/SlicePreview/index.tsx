import React, { useMemo } from "react";
import { Spinner } from "@depmap/common-components";
import {
  DataExplorerSettingsProvider,
  PlotlyLoaderProvider,
  usePlotlyLoader,
} from "@depmap/data-explorer-2";
import { SliceQuery } from "@depmap/types";
import useData from "../useData";
import ContinuousDataPreview from "./ContinuousDataPreview";
import CategoricalDataPreview from "./CategoricalDataPreview";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  index_type_name: string;
  value: SliceQuery | null;
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>;
  getContinuousFilterProps?: () => {
    hasFixedMin: boolean;
    hasFixedMax: boolean;
    minInclusive: boolean;
    maxInclusive: boolean;
    initialRange: [number | undefined, number | undefined];
    onChangeRange: (nextRange: [number, number]) => void;
    filterHelpText?: string;
  };
  getCategoricalFilterProps?: () => {
    selectionMode: "single" | "multiple";
    initialSelectedValues: Set<string | number>;
    onChangeSelectedValues: (nextSelectedValues: Set<string | number>) => void;
  };
}

function SlicePreview({
  index_type_name,
  value,
  PlotlyLoader,
  getContinuousFilterProps = undefined,
  getCategoricalFilterProps = undefined,
}: Props) {
  const slices = useMemo(() => (value ? [value] : []), [value]);

  const {
    error,
    loading,
    data: previewData,
    columns: previewColumns,
  } = useData({ index_type_name, slices });

  const column = useMemo(
    () =>
      previewColumns.find(({ meta }) => {
        return meta.sliceQuery.identifier === value?.identifier;
      }),
    [previewColumns, value?.identifier]
  );

  const isBinary = useMemo(() => {
    if (!previewData || !column) {
      return false;
    }
    const values = previewData.map((row) => row[column.id]);
    const distinct = new Set(values.filter((v) => v != null));

    return distinct.size <= 2 && [...distinct].every((n) => n === 0 || n === 1);
  }, [column, previewData]);

  if (error) {
    return <div>An unexpected error occurred.</div>;
  }

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div>
          <Spinner position="static" />
        </div>
        {value && value.identifier_type !== "column" && (
          <div>
            <Spinner position="static" />
          </div>
        )}
      </div>
    );
  }

  if (!column) {
    return (
      <div className={styles.previewPlaceholder}>
        <i>a data preview will appear here</i>
      </div>
    );
  }

  const previewType =
    column.meta.value_type === "continuous" && !isBinary
      ? "continuous"
      : "categorical";

  const values = previewData.map((row) => row[column.id]);
  const { idLabel, units, datasetName } = column.meta;
  const xAxisTitle = `${idLabel} ${units}<br>${datasetName}`;

  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <DataExplorerSettingsProvider>
        <div className={styles.SlicePreview}>
          {previewType === "continuous" ? (
            <ContinuousDataPreview
              values={values as number[]}
              hoverText={previewData.map(({ label }) => label) as string[]}
              xAxisTitle={xAxisTitle}
              getContinuousFilterProps={getContinuousFilterProps}
            />
          ) : (
            <CategoricalDataPreview
              dataValues={values as (number | string | string[])[]}
              xAxisTitle={xAxisTitle}
              hoverLabel={idLabel}
              getCategoricalFilterProps={getCategoricalFilterProps}
            />
          )}
        </div>
      </DataExplorerSettingsProvider>
    </PlotlyLoaderProvider>
  );
}

export default SlicePreview;
