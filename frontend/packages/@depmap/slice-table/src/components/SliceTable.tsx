import React, { useEffect } from "react";
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
  initialSlices?: SliceQuery[];
  viewOnlySlices?: Set<SliceQuery>;
  onChangeSlices?: (nextSlices: SliceQuery[]) => void;
  initialRowSelection?: RowSelectionState;
  enableRowSelection?: boolean;
  onChangeRowSelection?: (nextRowSelection: Record<string, boolean>) => void;
  renderCustomControls?: () => React.ReactNode;
  renderCustomActions?: () => React.ReactNode;
  downloadFilename?: string;
}

const getRowId = (row: Record<string, string | number | undefined>) => {
  return row.id as string;
};

const EMPTY_SET = new Set<SliceQuery>();
const EMPTY_OBJECT = {};
const NOOP = () => {};

function SliceTable({
  index_type_name,
  initialSlices = [],
  viewOnlySlices = EMPTY_SET,
  onChangeSlices = NOOP,
  initialRowSelection = EMPTY_OBJECT,
  enableRowSelection = false,
  onChangeRowSelection = NOOP,
  renderCustomControls = () => null,
  renderCustomActions = () => null,
  downloadFilename = "",
}: Props) {
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
  } = useSliceTableState({
    index_type_name,
    initialSlices,
    viewOnlySlices,
    enableRowSelection,
    initialRowSelection,
    onChangeSlices,
    downloadFilename,
  });

  useEffect(() => {
    if (rowSelection !== initialRowSelection) {
      onChangeRowSelection(rowSelection);
    }
  }, [rowSelection, initialRowSelection, onChangeRowSelection]);

  return (
    <div className={styles.SliceTable}>
      <Controls
        isLoading={loading}
        hadError={Boolean(error)}
        onClickFilterButton={handleClickFilterButton}
        onClickDownload={handleClickDownload}
        renderCustomControls={renderCustomControls}
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
        columnVisibility={{ label: shouldShowLabelColumn }}
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
