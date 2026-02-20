import React, { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@depmap/common-components";
import ReactTable from "@depmap/react-table";
import type { RowSelectionState } from "@depmap/react-table";
import type { SliceQuery } from "@depmap/types";
import Controls from "./Controls";
import Actions from "./Actions";
import { useSliceTableState, filterPredicate } from "./useSliceTableState";
import styles from "../styles/SliceTable.scss";

interface Props {
  index_type_name: string;
  getInitialState?: () => {
    initialSlices?: SliceQuery[];
    // Should be a subset of `initialSlices`
    viewOnlySlices?: Set<SliceQuery>;
    initialRowSelection?: RowSelectionState;
  };
  onChangeSlices?: (nextSlices: SliceQuery[]) => void;
  enableRowSelection?: boolean;
  onChangeRowSelection?: (nextRowSelection: Record<string, boolean>) => void;
  hideIdColumn?: boolean;
  hideLabelColumn?: boolean;
  // Dataset IDs that should not appear in the "Add Column" menus.
  hiddenDatasets?: Set<string>;
  customColumns?: {
    header: () => React.ReactNode;
    cell: ({ row }: { row: Record<"id", string> }) => React.ReactNode;
  }[];
  // Per-column display customization. Called once per column during column
  // definition building. Return `null` for default behavior, or an object with:
  // - `header`: custom header renderer (receives label and defaultElement)
  // - `cell`: full cell override (magnitude bars won't apply for this column)
  // - `numericPrecision`: format numbers with .toFixed(n), works with magnitude bars
  getColumnDisplayOptions?: (
    sliceQuery: SliceQuery
  ) => import("./useData").ColumnDisplayOptions | null;
  renderCustomControls?: () => React.ReactNode;
  renderCustomActions?: () => React.ReactNode;
  downloadFilename?: string;
  // An implicit filter that is always applied and invisible to the end user.
  // Rows for which this returns false are excluded from the dataset entirely —
  // they won't appear in the table, search results, magnitude bar stats, or
  // CSV exports. Use this to scope the table to a relevant subset of rows.
  implicitFilter?: (row: {
    id: string;
    label: string;
    getValue: (sliceQuery: SliceQuery) => unknown;
  }) => boolean;
  // Optional external loading state. When true, the table shows its loading
  // spinner and disables interactions until the external dependency is ready.
  // Most consumers don't need this — it's only necessary when props like
  // `implicitFilter` depend on data that must be fetched before the table
  // can render meaningfully.
  isLoading?: boolean;
  sliceTableRef?: React.RefObject<{
    // Use this to force `getInitialState()` to be called.
    forceInitialize: () => void;
  }>;
}

const getRowId = (row: Record<string, string | number | undefined>) => {
  return row.id as string;
};

const NOOP = () => {};

function SliceTable({
  index_type_name,
  getInitialState = () => ({}),
  onChangeSlices = NOOP,
  enableRowSelection = false,
  onChangeRowSelection = NOOP,
  hideIdColumn = false,
  hideLabelColumn = false,
  hiddenDatasets = undefined,
  customColumns = undefined,
  getColumnDisplayOptions = undefined,
  renderCustomControls = () => null,
  renderCustomActions = () => null,
  downloadFilename = "",
  implicitFilter = undefined,
  isLoading: externalLoading = false,
  sliceTableRef = undefined,
}: Props) {
  const [revision, setRevision] = useState(1);

  const { initialSlices, viewOnlySlices, initialRowSelection } = useMemo(() => {
    return {
      // defaults
      initialSlices: [] as SliceQuery[],
      viewOnlySlices: new Set<SliceQuery>(),
      initialRowSelection: {},
      // explicit state
      ...getInitialState(),
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  React.useImperativeHandle(
    sliceTableRef,
    () => ({ forceInitialize: () => setRevision((r) => r + 1) }),
    []
  );

  const tableRef = useRef<{
    resetColumnResizing: () => void;
    manuallyResizedColumns: Set<string>;
    resetSort: () => void;
    goToNextMatch: () => void;
    goToPreviousMatch: () => void;
    totalMatches: number;
    currentMatchIndex: number;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filterToSearchResults: boolean;
    setFilterToSearchResults: (enabled: boolean) => void;
    subscribeToSearch: (listener: () => void) => () => void;
    getDisplayRowIds: () => string[];
    getVisibleColumnIds: () => string[];
  }>(null);

  const {
    data,
    error,
    loading,
    columns,
    rowFilter,
    rowSelection,
    setRowSelection,
    handleClickDownload,
    handleClickAddColumn,
    handleClickFilterButton,
    shouldShowLabelColumn,
    numFiltersApplied,
  } = useSliceTableState({
    index_type_name,
    initialSlices,
    viewOnlySlices,
    enableRowSelection,
    customColumns,
    getColumnDisplayOptions,
    initialRowSelection,
    onChangeSlices,
    downloadFilename,
    tableRef,
    implicitFilter,
    hiddenDatasets,
  });

  const combinedLoading = loading || externalLoading;

  useEffect(() => {
    const keysA = Object.keys(rowSelection);
    const keysB = new Set(Object.keys(initialRowSelection));

    const hasSelectionChanges =
      keysA.length !== keysB.size || keysA.some((k) => !keysB.has(k));

    if (hasSelectionChanges) {
      onChangeRowSelection(rowSelection);
    }
  }, [rowSelection, initialRowSelection, onChangeRowSelection]);

  // Apply implicit filter before ReactTable sees the data. This shapes the
  // dataset itself — magnitude bar stats, search, and everything else will
  // be scoped to this subset. Unlike user-visible filters (which are handled
  // by ReactTable's rowFilter prop), these rows are excluded as if they
  // don't exist at all.
  const filteredData = useMemo(() => {
    if (!implicitFilter) {
      return data;
    }

    return data.filter(filterPredicate(columns, implicitFilter));
  }, [data, columns, implicitFilter]);

  return (
    <div className={styles.SliceTable}>
      <Controls
        tableRef={tableRef}
        isLoading={combinedLoading}
        hadError={Boolean(error)}
        onClickFilterButton={handleClickFilterButton}
        onClickDownload={handleClickDownload}
        renderCustomControls={renderCustomControls}
        numFiltersApplied={numFiltersApplied}
      />
      {combinedLoading && (
        <div className={styles.loadingContainer}>
          <Spinner position="static" />
        </div>
      )}
      {error && (
        <div className={styles.errorContainer}>
          <p>⚠️ Sorry, there was an error loading the table.</p>
          <details>{error}</details>
        </div>
      )}
      <ReactTable
        tableRef={tableRef}
        className={combinedLoading ? styles.hidden : ""}
        height="100%"
        data={filteredData}
        columns={columns}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={getRowId}
        enableRowSelection={enableRowSelection}
        enableMultiRowSelection
        enableStickyFirstColumn
        columnVisibility={{
          id: !hideIdColumn,
          label: shouldShowLabelColumn && !hideLabelColumn,
        }}
        enableSearch
        rowFilter={rowFilter}
        defaultSort={(a, b) => {
          const aId = getRowId(a);
          const bId = getRowId(b);

          const aSelected = initialRowSelection[aId] || false;
          const bSelected = initialRowSelection[bId] || false;

          if (aSelected && !bSelected) return -1;
          if (!aSelected && bSelected) return 1;

          return 0;
        }}
      />
      <Actions
        isLoading={combinedLoading}
        hadError={Boolean(error)}
        onClickAddColumn={handleClickAddColumn}
        renderCustomActions={renderCustomActions}
      />
    </div>
  );
}

export default SliceTable;
