import React from "react";
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
  renderCustomActions?: () => React.ReactNode;
  downloadFilename?: string;
}

const getRowId = (row: Record<string, string | number | undefined>) => {
  return row.id as string;
};

const EMPTY_SET = new Set<SliceQuery>();
const NOOP = () => {};

function SliceTable({
  index_type_name,
  initialSlices = [],
  viewOnlySlices = EMPTY_SET,
  onChangeSlices = NOOP,
  initialRowSelection = {},
  enableRowSelection = false,
  renderCustomActions = () => null,
  downloadFilename = "data-export.csv",
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
  } = useSliceTableState({
    index_type_name,
    initialSlices,
    viewOnlySlices,
    initialRowSelection,
    onChangeSlices,
    downloadFilename,
  });

  return (
    <div className={styles.SliceTable}>
      <Controls
        isLoading={loading}
        hadError={Boolean(error)}
        onClickFilterButton={handleClickFilterButton}
        onClickDownload={handleClickDownload}
      />
      {loading || error ? (
        <>
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
        </>
      ) : (
        <ReactTable
          height="100%"
          data={data}
          columns={columns}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={getRowId}
          enableRowSelection={enableRowSelection}
          enableMultiRowSelection
          enableStickyFirstColumn
          defaultSort={(a, b) => {
            const aId = getRowId(a);
            const bId = getRowId(b);

            const aSelected = rowSelection[aId] || false;
            const bSelected = rowSelection[bId] || false;

            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;

            return 0;
          }}
        />
      )}
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
