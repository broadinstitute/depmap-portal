import React, { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@depmap/common-components";
import ReactTable from "@depmap/react-table";
import type { RowSelectionState } from "@depmap/react-table";
import type { SliceQuery } from "@depmap/types";
import Controls from "./Controls";
import Actions from "./Actions";
import { useSliceTableState } from "./useSliceTableState";
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
  customColumns?: {
    header: () => React.ReactNode;
    cell: ({ row }: { row: Record<"id", string> }) => React.ReactNode;
  }[];
  headerCellRenderer?: ({
    label,
    sliceQuery,
    defaultElement,
  }: {
    label: string;
    sliceQuery: SliceQuery;
    defaultElement: React.ReactNode;
  }) => React.ReactNode;
  bodyCellRenderer?: ({
    label,
    sliceQuery,
    getValue,
  }: {
    label: string;
    sliceQuery: SliceQuery;
    getValue: () => React.ReactNode;
  }) => React.ReactNode;
  renderCustomControls?: () => React.ReactNode;
  renderCustomActions?: () => React.ReactNode;
  downloadFilename?: string;
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
  customColumns = undefined,
  headerCellRenderer = undefined,
  bodyCellRenderer = undefined,
  renderCustomControls = () => null,
  renderCustomActions = () => null,
  downloadFilename = "",
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
    subscribeToSearch: any;
  }>(null);

  const {
    data,
    error,
    loading,
    columns,
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
    headerCellRenderer,
    bodyCellRenderer,
    initialRowSelection,
    onChangeSlices,
    downloadFilename,
  });

  useEffect(() => {
    const keysA = Object.keys(rowSelection);
    const keysB = new Set(Object.keys(initialRowSelection));

    const hasSelectionChanges =
      keysA.length !== keysB.size || keysA.some((k) => !keysB.has(k));

    if (hasSelectionChanges) {
      onChangeRowSelection(rowSelection);
    }
  }, [rowSelection, initialRowSelection, onChangeRowSelection]);

  return (
    <div className={styles.SliceTable}>
      <Controls
        tableRef={tableRef}
        isLoading={loading}
        hadError={Boolean(error)}
        onClickFilterButton={handleClickFilterButton}
        onClickDownload={handleClickDownload}
        renderCustomControls={renderCustomControls}
        numFiltersApplied={numFiltersApplied}
      />
      {loading && (
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
        className={loading ? styles.hidden : ""}
        height="100%"
        data={data}
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
        isLoading={loading}
        hadError={Boolean(error)}
        onClickAddColumn={handleClickAddColumn}
        renderCustomActions={renderCustomActions}
      />
    </div>
  );
}

export default SliceTable;
