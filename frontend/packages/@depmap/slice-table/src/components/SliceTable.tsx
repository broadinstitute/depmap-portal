import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cx from "classnames";
import { Spinner } from "@depmap/common-components";
import ReactTable from "@depmap/react-table";
import type { RowSelectionState, SortingState } from "@depmap/react-table";
import type { SliceQuery } from "@depmap/types";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import Controls from "./Controls";
import rowSelectionChanged from "./rowSelectionChanged";
import Actions from "./Actions";
import LoadingProgress from "./LoadingProgress";
import {
  useSliceTableState,
  filterPredicate,
  CustomColumn,
  CustomColumnPlacement,
} from "./useSliceTableState";
import styles from "../styles/SliceTable.scss";

interface Props {
  index_type_name: string;
  // Required, and not read from context, on purpose. SliceTable draws slice
  // previews with Plotly, and it is very often rendered into a modal — which
  // means a detached React tree that no provider above the app reaches. Taking
  // it as a prop turns "I forgot the provider" from a runtime error someone
  // hits when they open a preview into a compile error.
  //
  // `any` for the same reason PlotlyLoaderProvider uses it: the concrete
  // loaders each app supplies don't structurally satisfy PlotlyLoaderType, and
  // reconciling Plotly's versions is more trouble than it is worth. The point
  // of this prop is that it must be *passed*, not that it is precisely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PlotlyLoader: any;
  getInitialState?: () => {
    initialSlices?: SliceQuery[];
    // Should be a subset of `initialSlices`
    viewOnlySlices?: Set<SliceQuery>;
    initialRowSelection?: RowSelectionState;
  };
  onChangeSlices?: (nextSlices: SliceQuery[]) => void;
  // Called when the table fails to load outright — it couldn't even build its
  // index — in addition to (not instead of) the error the table renders itself.
  // A single column failing to load doesn't come through here; that degrades to
  // a stub column and leaves the rest of the table usable.
  //
  // For callers that persist their column choice: a set that fails to load will
  // keep failing to load, so this is the hook for throwing the persisted set
  // away. The "Try again" button rendered alongside the error re-reads
  // `getInitialState` for exactly that reason, so whatever this callback
  // discards is gone by the time the retry starts.
  onLoadError?: (error: string) => void;
  // Pass a predicate to make only some rows selectable — the checkbox renders
  // disabled for the rest, and "select all" skips them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enableRowSelection?: boolean | ((row: any) => boolean);
  enableMultiRowSelection?: boolean;
  // Ceiling on what a single "select all" click takes, from the top of the
  // current display order. Individual checkboxes stay unrestricted — this only
  // stops the one click that can blow past a limit in one go. Forwarded to
  // ReactTable, which is the only thing that knows what order the rows are in.
  maxRowSelection?: number;
  onChangeRowSelection?: (nextRowSelection: Record<string, boolean>) => void;
  // Which column the table opens sorted by. Supplying it suppresses the
  // built-in "rows that started selected come first" ordering, which is the
  // point: a header showing a sort indicator should mean that sort is in
  // effect, not that something else quietly reordered the rows first.
  initialSorting?: SortingState;
  hideIdColumn?: boolean;
  hideLabelColumn?: boolean;
  // Dataset IDs that should not appear in the "Add Column" menus.
  hiddenDatasets?: Set<string>;
  // Columns the caller supplies itself, for values that aren't Breadbox slices.
  // Give an entry an `accessorFn` to make it sortable, searchable and
  // exportable; omit it for a column that only renders controls.
  customColumns?: CustomColumn[];
  // Where those columns sit relative to the slice columns. Defaults to "end".
  customColumnPlacement?: CustomColumnPlacement;
  // Per-column display customization. Called once per column during column
  // definition building. Return `null` for default behavior, or an object with:
  // - `header`: custom header renderer (receives label and defaultElement)
  // - `cell`: full cell override (magnitude bars won't apply for this column)
  // - `numericPrecision`: format numbers with .toFixed(n), works with magnitude bars
  getColumnDisplayOptions?: (
    sliceQuery: SliceQuery
  ) => import("./useData").ColumnDisplayOptions | null;
  // Custom controls will appear at the top of the table (to left of the search
  // bar).
  renderCustomControls?: (info: {
    isLoading: boolean;
    hadError: boolean;
    onClickAddColumn: () => void;
  }) => React.ReactNode;
  // Custom actions will appear at the botom of the table (to the right of "Add
  // column").
  renderCustomActions?: () => React.ReactNode;
  // Use this if you want to complete hide the actions bar. Does nothing if
  // `renderCustomControls` is defined.
  hideActions?: boolean;
  // Use this to apply custom CSS to the container div.
  containerClassName?: string;
  // Use this to apply custom CSS to the controls.
  controlsClassName?: string;
  downloadFilename?: string;
  // An implicit filter that is always applied and invisible to the end user.
  // Rows for which this returns false are excluded from the dataset entirely —
  // they won't appear in the table, search results, magnitude bar stats, or
  // CSV exports. Use this to scope the table to a relevant subset of rows.
  //
  // `getValue` resolves against the table's LOADED columns only — a slice in
  // `initialSlices`, one the user added, or one they since removed (those are
  // cached). It does NOT fetch. Naming a slice the table was never asked to
  // display returns `undefined`, and because `undefined` compares unequal to
  // whatever you meant, the filter quietly excludes every row rather than
  // failing. Two ways to avoid that:
  //
  //   - Put the slice in `initialSlices`, accepting that it shows as a column.
  //   - Resolve what you need yourself and filter on `id`, holding the table on
  //     `isLoading` until it arrives. This is what every current caller does;
  //     showGeneTranscriptTable is the worked example.
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
  PlotlyLoader,
  getInitialState = () => ({}),
  onChangeSlices = NOOP,
  onLoadError = NOOP,
  enableRowSelection = false,
  enableMultiRowSelection = false,
  maxRowSelection = undefined,
  onChangeRowSelection = NOOP,
  initialSorting = undefined,
  hideIdColumn = false,
  hideLabelColumn = false,
  hiddenDatasets = undefined,
  customColumns = undefined,
  customColumnPlacement = "end",
  getColumnDisplayOptions = undefined,
  renderCustomControls = () => null,
  renderCustomActions = undefined,
  hideActions = false,
  containerClassName = undefined,
  controlsClassName = undefined,
  downloadFilename = "",
  implicitFilter = undefined,
  isLoading: externalLoading = false,
  sliceTableRef = undefined,
}: Props) {
  const [revision, setRevision] = useState(1);
  const [retryToken, setRetryToken] = useState(0);

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
    progress,
    columns,
    rowFilter,
    rowSelection,
    setRowSelection,
    handleClickDownload,
    handleClickAddColumn,
    handleClickFilterButton,
    shouldShowLabelColumn,
    numFiltersApplied,
    sliceDataCacheRef,
  } = useSliceTableState({
    index_type_name,
    PlotlyLoader,
    initialSlices,
    viewOnlySlices,
    enableRowSelection,
    customColumns,
    customColumnPlacement,
    getColumnDisplayOptions,
    initialRowSelection,
    onChangeSlices,
    downloadFilename,
    tableRef,
    implicitFilter,
    hiddenDatasets,
    retryToken,
  });

  // Two counters bumped together, not one. The revision re-reads
  // `getInitialState`, which is what gives `onLoadError` a chance to have
  // mattered — a caller that forgot its remembered columns retries with the
  // smaller set. The token is what guarantees a refetch at all: when the caller
  // hands back the identical slices (a stable array, or nothing persisted to
  // forget), the revision alone changes nothing useData can see.
  const handleClickRetry = useCallback(() => {
    setRevision((r) => r + 1);
    setRetryToken((t) => t + 1);
  }, []);

  const combinedLoading = loading || externalLoading;

  // Held in a ref so the effect below depends on the error alone. Callers pass
  // this inline, and a new function identity every render would otherwise mean
  // one notification per render for as long as the error is on screen.
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    if (error) {
      onLoadErrorRef.current(error);
    }
  }, [error]);

  // Compared against what was last *reported*, not against the initial
  // selection. Comparing against the initial one suppressed every return to it:
  // adding a row past the seed reported the addition, and then removing that
  // same row reported nothing, because the result matched the seed again. The
  // consumer's count stayed stuck one high, and only for rows in the seed —
  // which is what made it look like particular rows were broken.
  //
  // The comparison is over *selected ids* rather than keys. TanStack may
  // represent a deselected row as an absent key or as an explicit `false`, and
  // by keys alone those two read as different selections while meaning the same
  // thing.
  const lastReportedRef = useRef(initialRowSelection);
  const prevInitialRef = useRef(initialRowSelection);

  // Adopting a new seed is an initialization, not a user action: re-baseline so
  // it isn't reported back to the consumer that supplied it. Done during render,
  // alongside the equivalent adjustment in useSliceTableState, so the effect
  // below never sees a baseline that lags the selection it is judging.
  if (prevInitialRef.current !== initialRowSelection) {
    prevInitialRef.current = initialRowSelection;
    lastReportedRef.current = initialRowSelection;
  }

  useEffect(() => {
    if (rowSelectionChanged(lastReportedRef.current, rowSelection)) {
      lastReportedRef.current = rowSelection;
      onChangeRowSelection(rowSelection);
    }
  }, [rowSelection, onChangeRowSelection]);

  // Apply implicit filter before ReactTable sees the data. This shapes the
  // dataset itself — magnitude bar stats, search, and everything else will
  // be scoped to this subset. Unlike user-visible filters (which are handled
  // by ReactTable's rowFilter prop), these rows are excluded as if they
  // don't exist at all.
  const filteredData = useMemo(() => {
    if (!implicitFilter) {
      return data;
    }

    return data.filter(
      filterPredicate(columns, implicitFilter, sliceDataCacheRef.current)
    );
  }, [data, columns, implicitFilter, sliceDataCacheRef]);

  return (
    // Provided here rather than expected from above, so that callers rendering
    // into a modal don't each have to remember to do it.
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <div className={cx(styles.SliceTable, containerClassName)}>
        <Controls
          controlsClassName={controlsClassName}
          tableRef={tableRef}
          isLoading={combinedLoading}
          hadError={Boolean(error)}
          onClickFilterButton={handleClickFilterButton}
          onClickDownload={handleClickDownload}
          renderCustomControls={renderCustomControls}
          numFiltersApplied={numFiltersApplied}
          onClickAddColumn={handleClickAddColumn}
        />
        {combinedLoading && (
          <div className={styles.loadingContainer}>
            <Spinner position="static" />
            {/* Gated on `progress` so a caller's own `isLoading` keeps the
                bare spinner — it has no column count behind it. */}
            {progress && (
              <LoadingProgress
                loaded={progress.loaded}
                total={progress.total}
              />
            )}
          </div>
        )}
        {error && !combinedLoading && (
          <div className={styles.errorContainer}>
            <div>
              <p>⚠️ Sorry, there was an error loading the table.</p>
              <button
                type="button"
                className={cx("btn", "btn-default", styles.retryButton)}
                onClick={handleClickRetry}
              >
                <span className="glyphicon glyphicon-refresh" /> Try again
              </button>
            </div>
            <details>{error}</details>
          </div>
        )}
        <ReactTable
          tableRef={tableRef}
          // Hidden rather than unmounted so `tableRef` stays live. An error here
          // means the index itself couldn't be built, so the table has no rows
          // to show and no prospect of any — leaving it visible put "There are
          // no rows to display" under the error message, which reads as a second
          // unrelated thing having gone wrong.
          className={combinedLoading || error ? styles.hidden : ""}
          height="100%"
          data={filteredData}
          columns={columns}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={getRowId}
          initialSorting={initialSorting}
          enableRowSelection={enableRowSelection}
          enableMultiRowSelection={enableMultiRowSelection}
          maxRowSelection={maxRowSelection}
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

            const aIdNum = Number(aId);
            const bIdNum = Number(bId);

            if (!Number.isNaN(aIdNum) && !Number.isNaN(bIdNum)) {
              return aIdNum < bIdNum ? -1 : 1;
            }

            return 0;
          }}
        />
        {(!hideActions || renderCustomActions) && (
          <Actions
            isLoading={combinedLoading}
            hadError={Boolean(error)}
            onClickAddColumn={handleClickAddColumn}
            renderCustomActions={renderCustomActions}
          />
        )}
      </div>
    </PlotlyLoaderProvider>
  );
}

export default SliceTable;
