import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "react-bootstrap";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import type { RowSelectionState } from "@depmap/react-table";
import type { SliceQuery } from "@depmap/types";
import useData from "./useData";
import type { RowFilters } from "./useData";
import chooseDataSlice from "./chooseDataSlice";
import chooseFilters from "./chooseFilters";
import showDataSlicePreview from "./showDataSlicePreview";
import styles from "../styles/SliceTable.scss";

interface Props {
  index_type_name: string;
  initialSlices: SliceQuery[];
  viewOnlySlices: Set<SliceQuery>;
  initialRowSelection: RowSelectionState;
  onChangeSlices: (nextSlices: SliceQuery[]) => void;
  downloadFilename: string;
}

const defaultRowFilters = {
  hideUnselectedRows: false,
  hideIncompleteRows: false,
};

export function useSliceTableState({
  index_type_name,
  initialSlices,
  viewOnlySlices,
  initialRowSelection,
  onChangeSlices,
  downloadFilename,
}: Props) {
  const [slices, setSlices] = useState<SliceQuery[]>(initialSlices || []);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialRowSelection || {}
  );

  const prevIndexTypeName = useRef(index_type_name);

  useEffect(() => {
    // It is not typical for `index_type_name` to change.
    // But when it does, it means all our slices are invalid.
    if (index_type_name !== prevIndexTypeName.current) {
      setSlices([]);
    }

    prevIndexTypeName.current = index_type_name;
  }, [index_type_name]);

  // Convert rowSelection to selectedRowIds
  const selectedRowIds = useMemo(() => {
    return new Set(
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([rowId]) => rowId)
    );
  }, [rowSelection]);

  // TODO: Also implement column-based filters
  const [rowFilters, setRowFilters] = useState<RowFilters>(defaultRowFilters);

  useEffect(() => {
    if (slices !== initialSlices) {
      onChangeSlices(slices);
    }
  }, [initialSlices, slices, onChangeSlices]);

  const { columns, data, loading, error, exportToCsv } = useData({
    index_type_name,
    slices,
    viewOnlySlices,
    rowFilters,
    selectedRowIds,
  });

  let shouldShowLabelColumn = true;

  if (
    columns &&
    columns.length >= 2 &&
    columns[0].meta.idLabel === columns[1].meta.idLabel
  ) {
    shouldShowLabelColumn = false;
  }

  const PlotlyLoader = usePlotlyLoader();

  const handleClickAddColumn = useCallback(async () => {
    const newSlice = await chooseDataSlice({ index_type_name, PlotlyLoader });

    if (newSlice) {
      setSlices((prev) => [...prev, newSlice]);
    }
  }, [index_type_name, PlotlyLoader]);

  const handleClickEditColumn = useCallback(
    async (column: typeof columns[number]) => {
      const defaultValue = column.meta.sliceQuery;

      const editedSlice = await chooseDataSlice({
        defaultValue,
        index_type_name,
        PlotlyLoader,
        onClickRemoveColumn: () => {
          setSlices((prev) => {
            return prev.filter((slice) => slice !== column.meta.sliceQuery);
          });
        },
      });

      if (editedSlice) {
        setSlices((prev) =>
          prev.map((slice) =>
            slice === column.meta.sliceQuery ? editedSlice : slice
          )
        );
      }
    },
    [index_type_name, PlotlyLoader]
  );

  const handleClickViewColumn = useCallback(
    async (column: typeof columns[number]) => {
      showDataSlicePreview({
        index_type_name,
        PlotlyLoader,
        sliceQuery: column.meta.sliceQuery,
      });
    },
    [index_type_name, PlotlyLoader]
  );

  const columnsWithEditOrViewButton = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      header:
        !column.meta.isEditable && !column.meta.isViewable
          ? column.header
          : () => (
              <div className={styles.editableColumnHeader}>
                {column.header()}
                <Button
                  bsSize="sm"
                  onClick={(e) => {
                    e.stopPropagation();

                    if (column.meta.isEditable) {
                      handleClickEditColumn(column);
                    } else {
                      handleClickViewColumn(column);
                    }
                  }}
                >
                  <i
                    className={[
                      "glyphicon",
                      column.meta.isEditable
                        ? "glyphicon-edit"
                        : "glyphicon-eye-open",
                    ].join(" ")}
                  />
                </Button>
              </div>
            ),
    }));
  }, [columns, handleClickEditColumn, handleClickViewColumn]);

  const handleClickFilterButton = useCallback(async () => {
    const result = await chooseFilters({ rowFilters });

    if (result) {
      setRowFilters(result);
    }
  }, [rowFilters]);

  const handleClickDownload = useCallback(() => {
    const csvString = exportToCsv();

    // Download as file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const dlAttr = downloadFilename.endsWith(".csv")
      ? downloadFilename
      : `${downloadFilename}.csv`;

    const link = document.createElement("a");
    link.setAttribute("href", href);
    link.setAttribute("download", dlAttr);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadFilename, exportToCsv]);

  return {
    data,
    error,
    loading,
    columns: columnsWithEditOrViewButton,
    handleClickAddColumn,
    handleClickDownload,
    handleClickFilterButton,
    rowSelection,
    setRowSelection,
    shouldShowLabelColumn,
  };
}
