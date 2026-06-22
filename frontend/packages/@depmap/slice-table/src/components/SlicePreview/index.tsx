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
  // The set of rows that would be visible if the user had no filters applied
  // (i.e. with only the table's `implicitFilter` taken into account). When
  // provided, this is used as the baseline for the "filtered rows only"
  // indicator: the indicator only shows if `visibleRowIds` is a strict subset
  // of `unfilteredRowIds`. The implicit filter is invisible to the end user,
  // so it should not on its own trigger the indicator. When omitted (no
  // implicit filter is configured), the full preview dataset is used as the
  // baseline.
  unfilteredRowIds?: Set<string>;
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
  unfilteredRowIds = undefined,
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
      <div className={styles.previewPlaceholder} data-preview-placeholder>
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

  // Baseline for the "filtered rows only" indicator. When `unfilteredRowIds`
  // is provided (i.e. the parent table has an `implicitFilter`), use the
  // count of preview rows that pass the implicit filter as the baseline.
  // This way the indicator only fires when the user's own filters have
  // narrowed things further — the implicit filter alone doesn't count,
  // since it's invisible to the user.
  const baselineCount = unfilteredRowIds
    ? previewData.filter((row) => unfilteredRowIds.has(row.id as string)).length
    : previewData.length;

  const isFiltered =
    visibleRowIds !== undefined && scopedData.length < baselineCount;

  let xAxisTitle = `${idLabel}`;

  if (units && units !== "unitless") {
    xAxisTitle += ` (${units})`;
  }

  if (datasetName) {
    xAxisTitle += `<br>${datasetName}`;
  } else {
    xAxisTitle += `<br><br>`;
  }

  if (isFiltered) {
    xAxisTitle += " <i>(filtered rows only)</i>";
  }

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
