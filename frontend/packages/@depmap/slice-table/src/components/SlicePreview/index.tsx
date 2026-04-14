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
  extraHoverData?: Record<string, string>;
  initiallyShowNulls?: boolean;
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
  // When provided, the preview only includes rows with these IDs. This keeps
  // the distribution in sync with whatever filters are applied to the parent
  // table. When omitted, all rows are shown.
  visibleRowIds?: Set<string>;
}

function SlicePreview({
  index_type_name,
  value,
  PlotlyLoader,
  extraHoverData = undefined,
  initiallyShowNulls = false,
  getContinuousFilterProps = undefined,
  getCategoricalFilterProps = undefined,
  visibleRowIds = undefined,
}: Props) {
  const slices = useMemo(() => (value ? [value] : []), [value]);

  const {
    error,
    loading,
    data: previewData,
    columns: previewColumns,
    entityLabel,
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

  // When visibleRowIds is provided, scope the preview to only those rows.
  // This keeps the distribution in sync with the table's current filters.
  const scopedData = useMemo(() => {
    if (!visibleRowIds) return previewData;
    return previewData.filter((row) => visibleRowIds.has(row.id as string));
  }, [previewData, visibleRowIds]);

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

  const values = scopedData.map((row) => row[column.id]);
  const isEmpty = scopedData.every((row) => row[column.id] === undefined);
  const { idLabel, units, datasetName } = column.meta;
  const isFiltered =
    visibleRowIds !== undefined && scopedData.length < previewData.length;
  const xAxisTitle =
    `${idLabel} ${units}<br>${datasetName}` +
    (isFiltered ? " <i>(filtered rows only)</i>" : "");

  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <DataExplorerSettingsProvider>
        <div className={styles.SlicePreview}>
          {previewType === "continuous" ? (
            <ContinuousDataPreview
              values={values as number[]}
              hoverText={scopedData.map((row) => {
                const extra = extraHoverData?.[row.id as string];
                return extra
                  ? `${row.label}<br>${extra}`
                  : (row.label as string);
              })}
              xAxisTitle={xAxisTitle}
              getContinuousFilterProps={getContinuousFilterProps}
            />
          ) : (
            <CategoricalDataPreview
              dataValues={values as (number | string | string[])[]}
              xAxisTitle={xAxisTitle}
              hoverLabel={idLabel}
              entityLabel={entityLabel}
              totalCount={previewData.length}
              getCategoricalFilterProps={getCategoricalFilterProps}
              initiallyShowNulls={initiallyShowNulls || isEmpty}
            />
          )}
        </div>
      </DataExplorerSettingsProvider>
    </PlotlyLoaderProvider>
  );
}

export default SlicePreview;
