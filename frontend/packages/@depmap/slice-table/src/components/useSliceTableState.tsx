import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { getConfirmation } from "@depmap/common-components";
import { usePlotlyLoader } from "@depmap/data-explorer-2";
import { RowSelectionState } from "@depmap/react-table";
import { areSliceQueriesEqual, SliceQuery } from "@depmap/types";
import useData, { RowFilters } from "./useData";
import chooseDataSlice from "./chooseDataSlice";
import chooseFilters from "./chooseFilters";
import showDataSlicePreview from "./showDataSlicePreview";

interface Props {
  index_type_name: string;
  initialSlices: SliceQuery[];
  viewOnlySlices: Set<SliceQuery>;
  enableRowSelection: boolean;
  initialRowSelection: RowSelectionState;
  onChangeSlices: (nextSlices: SliceQuery[]) => void;
  downloadFilename: string;
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
}

const defaultRowFilters = {
  hideUnselectedRows: false,
  hideIncompleteRows: false,
};

export function useSliceTableState({
  index_type_name,
  initialSlices,
  viewOnlySlices,
  enableRowSelection,
  initialRowSelection,
  onChangeSlices,
  downloadFilename,
  customColumns = undefined,
  headerCellRenderer = undefined,
  bodyCellRenderer = undefined,
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
    bodyCellRenderer,
    headerCellRenderer,
    index_type_name,
    slices,
    viewOnlySlices,
    rowFilters,
    selectedRowIds,
  });

  const idColumnLabel = columns[0]?.meta.idLabel;
  let shouldShowLabelColumn = true;

  if (
    columns &&
    columns.length >= 2 &&
    idColumnLabel === columns[1].meta.idLabel
  ) {
    shouldShowLabelColumn = false;
  }

  const PlotlyLoader = usePlotlyLoader();

  const handleClickAddColumn = useCallback(async () => {
    const newSlice = await chooseDataSlice({
      index_type_name,
      PlotlyLoader,
      existingSlices: slices,
      idColumnLabel,
    });

    if (newSlice) {
      setSlices((prev) => {
        if (prev.find((oldSlice) => areSliceQueriesEqual(oldSlice, newSlice))) {
          return prev;
        }

        return [...prev, newSlice];
      });
    }
  }, [idColumnLabel, index_type_name, PlotlyLoader, slices]);

  const handleClickEditColumn = useCallback(
    async (column: typeof columns[number]) => {
      const defaultValue = column.meta.sliceQuery;

      const datasets = await cached(breadboxAPI).getDatasets();
      const dataset = datasets.find(
        (d) =>
          d.id === defaultValue.dataset_id ||
          d.given_id === defaultValue.dataset_id
      );
      const initialSource = ["Annotations", "metadata"].includes(
        dataset?.data_type || ""
      )
        ? "property"
        : "custom";

      const editedSlice = await chooseDataSlice({
        defaultValue,
        initialSource,
        index_type_name,
        PlotlyLoader,
        existingSlices: slices,
        idColumnLabel,
      });

      if (editedSlice) {
        setSlices((prev) =>
          prev.map((slice) =>
            slice === column.meta.sliceQuery ? editedSlice : slice
          )
        );
      }
    },
    [idColumnLabel, index_type_name, PlotlyLoader, slices]
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

  const extendedColumns = useMemo(() => {
    const OFFSET = columns.length - slices.length;

    const sliceColumns = columns.map((column, colIndex) => ({
      ...column,
      meta: {
        ...column.meta,
        headerMenuItems: [
          column.meta.isEditable && {
            label: "View distribution",
            icon: "glyphicon-eye-open",
            onClick: () => handleClickEditColumn(column),
          },

          !column.meta.isEditable &&
            column.meta.isViewable && {
              label: "View distribution",
              icon: "glyphicon-eye-open",
              onClick: () => handleClickViewColumn(column),
            },

          colIndex >= OFFSET && {
            label: "Move column left",
            icon: "glyphicon-arrow-left",
            disabled: colIndex <= OFFSET,
            onClick: () => {
              setSlices((prev) => {
                const index = colIndex - OFFSET;

                const newSlices = [...prev];
                [newSlices[index - 1], newSlices[index]] = [
                  newSlices[index],
                  newSlices[index - 1],
                ];

                return newSlices;
              });
            },
          },

          colIndex >= OFFSET && {
            label: "Move column right",
            icon: "glyphicon-arrow-right",
            disabled: colIndex < OFFSET || colIndex >= columns.length - 1,
            onClick: () => {
              setSlices((prev) => {
                const index = colIndex - OFFSET;

                const newSlices = [...prev];
                [newSlices[index], newSlices[index + 1]] = [
                  newSlices[index + 1],
                  newSlices[index],
                ];

                return newSlices;
              });
            },
          },

          column.meta.isEditable && {
            widget: "divider",
          },

          column.meta.isEditable && {
            label: "Remove column",
            icon: "glyphicon-remove-sign",
            onClick: async () => {
              const confirmed = await getConfirmation({
                message: (
                  <div>
                    Are you sure you want to remove the column{" "}
                    <b>“{column.meta.sliceQuery.identifier}”</b>?
                  </div>
                ),
                yesText: "Remove",
                noText: "Cancel",
              });

              if (confirmed) {
                setTimeout(() => {
                  setSlices((prev) => {
                    return prev.filter(
                      (slice) =>
                        !areSliceQueriesEqual(slice, column.meta.sliceQuery)
                    );
                  });
                });
              }
            },
          },
        ].filter(Boolean),
      },
    }));

    const nonSliceColumns = (customColumns || []).map((col, i) => ({
      header: col.header,
      cell: col.cell,
      id: `custom-${i}`,
      accessorFn: () => null,
      enableSorting: false,
      meta: {
        idLabel: "",
        units: "",
        value_type: null,
        datasetName: "",
        csvHeader: "",
        sliceQuery: {} as SliceQuery,
        isEditable: false,
        isViewable: false,
      },
    }));

    return [...sliceColumns, ...nonSliceColumns];
  }, [
    columns,
    customColumns,
    handleClickEditColumn,
    handleClickViewColumn,
    slices.length,
  ]);

  const handleClickFilterButton = useCallback(async () => {
    const result = await chooseFilters({ enableRowSelection, rowFilters });

    if (result) {
      setRowFilters(result);
    }
  }, [enableRowSelection, rowFilters]);

  const handleClickDownload = useCallback(() => {
    const csvString = exportToCsv();

    // Download as file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);

    let dlAttr = downloadFilename || `${index_type_name} table`;
    if (!dlAttr.endsWith(".csv")) {
      dlAttr += ".csv";
    }

    const link = document.createElement("a");
    link.setAttribute("href", href);
    link.setAttribute("download", dlAttr);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [index_type_name, downloadFilename, exportToCsv]);

  return {
    data,
    error,
    loading,
    columns: extendedColumns,
    handleClickAddColumn,
    handleClickDownload,
    handleClickFilterButton,
    rowSelection,
    setRowSelection,
    shouldShowLabelColumn,
    numFiltersApplied: Object.values(rowFilters).filter(Boolean).length,
  };
}
