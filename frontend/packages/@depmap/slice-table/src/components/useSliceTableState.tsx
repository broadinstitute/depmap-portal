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
  tableRef: React.RefObject<{
    filterToSearchResults: boolean;
    setFilterToSearchResults: (enabled: boolean) => void;
    getDisplayRowIds: () => string[];
    getVisibleColumnIds: () => string[];
  }>;
  implicitFilter?: (row: {
    id: string;
    label: string;
    getValue: (sliceQuery: SliceQuery) => unknown;
  }) => boolean;
  customColumns?: {
    header: () => React.ReactNode;
    cell: ({ row }: { row: Record<"id", string> }) => React.ReactNode;
  }[];
  getColumnDisplayOptions?: (
    sliceQuery: SliceQuery
  ) => import("./useData").ColumnDisplayOptions | null;
  hiddenDatasets?: Set<string>;
}

const defaultRowFilters = {
  hideUnselectedRows: false,
  hideIncompleteRows: false,
  hideRowsWithNoSearchResults: false,
};

export const filterPredicate = (
  columns: ReturnType<typeof useSliceTableState>["columns"],
  implicitFilter: Props["implicitFilter"]
) => {
  if (!implicitFilter) {
    return () => true;
  }

  return (row: Record<string, string | string[] | number | undefined>) => {
    const id = row.id as string;
    const label = row.label as string;

    return implicitFilter({
      id,
      label,
      getValue: (sq: SliceQuery) => {
        const column = columns.find((c) => {
          return areSliceQueriesEqual(sq, c.meta.sliceQuery);
        });

        return column ? row[column.id] : undefined;
      },
    });
  };
};

export function useSliceTableState({
  index_type_name,
  initialSlices,
  viewOnlySlices,
  enableRowSelection,
  initialRowSelection,
  onChangeSlices,
  downloadFilename,
  tableRef,
  implicitFilter = undefined,
  customColumns = undefined,
  getColumnDisplayOptions = undefined,
  hiddenDatasets = undefined,
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
    tableRef.current?.setFilterToSearchResults(
      rowFilters.hideRowsWithNoSearchResults
    );
  }, [rowFilters, tableRef]);

  useEffect(() => {
    if (slices !== initialSlices) {
      onChangeSlices(slices);
    }
  }, [initialSlices, slices, onChangeSlices]);

  // Fetch data without any filtering — useData now returns the full dataset
  const { columns, data, loading, error, exportToCsv } = useData({
    getColumnDisplayOptions,
    index_type_name,
    slices,
    viewOnlySlices,
  });

  // Build a row filter predicate that combines hide-unselected and
  // hide-incomplete. This is passed to ReactTable's `rowFilter` prop so
  // that column stats (magnitude bars) are computed from the full dataset
  // while only matching rows are displayed.
  //
  // `hideRowsWithNoSearchResults` is NOT included here — it's handled by
  // ReactTable's own `filterToSearchResults` mechanism because ReactTable
  // owns the search state needed to evaluate it.
  const rowFilter = useMemo(() => {
    const { hideUnselectedRows, hideIncompleteRows } = rowFilters;

    // If no filters are active, return undefined so ReactTable skips filtering
    if (!hideUnselectedRows && !hideIncompleteRows) {
      return undefined;
    }

    return (row: Record<string, string | number | undefined>) => {
      if (hideUnselectedRows) {
        const rowId = row.id as string;
        if (!selectedRowIds.has(rowId)) {
          return false;
        }
      }

      if (hideIncompleteRows) {
        const hasUndefinedValues = Object.entries(row).some(([key, value]) => {
          // Skip id and label columns for completeness check
          if (key === "id" || key === "label") {
            return false;
          }

          return (
            value === undefined || (Array.isArray(value) && value.length === 0)
          );
        });

        if (hasUndefinedValues) {
          return false;
        }
      }

      return true;
    };
  }, [rowFilters, selectedRowIds]);

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

  const buildExtraHoverData = useCallback(
    (excludeColumnId: string): Record<string, string> => {
      const otherCols = columns.filter(
        (c) => c.id !== excludeColumnId && c.id !== "label"
      );

      const result: Record<string, string> = {};

      if (otherCols.length > 0) {
        for (const row of data) {
          const id = row.id as string;
          const lines: string[] = [];

          for (const c of otherCols) {
            const val = row[c.id];
            if (val != null) {
              const label =
                typeof c.header === "string"
                  ? c.header
                  : c.meta?.idLabel ?? c.id;
              lines.push(`${label}: ${val}`);
            }
          }

          if (lines.length > 0) {
            result[id] = lines.join("<br>");
          }
        }
      }

      return result;
    },
    [columns, data]
  );

  const handleClickAddColumn = useCallback(async () => {
    const newSlice = await chooseDataSlice({
      index_type_name,
      PlotlyLoader,
      existingSlices: slices,
      idColumnLabel,
      hiddenDatasets,
      extraHoverData: buildExtraHoverData(""),
    });

    if (newSlice) {
      setSlices((prev) => {
        if (prev.find((oldSlice) => areSliceQueriesEqual(oldSlice, newSlice))) {
          return prev;
        }

        return [...prev, newSlice];
      });
    }
  }, [
    hiddenDatasets,
    idColumnLabel,
    index_type_name,
    PlotlyLoader,
    slices,
    buildExtraHoverData,
  ]);

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
        hiddenDatasets,
        extraHoverData: buildExtraHoverData(column.id),
      });

      if (editedSlice) {
        setSlices((prev) =>
          prev.map((slice) =>
            slice === column.meta.sliceQuery ? editedSlice : slice
          )
        );
      }
    },
    [
      hiddenDatasets,
      idColumnLabel,
      index_type_name,
      PlotlyLoader,
      slices,
      buildExtraHoverData,
    ]
  );

  const handleClickViewColumn = useCallback(
    async (column: typeof columns[number]) => {
      showDataSlicePreview({
        index_type_name,
        PlotlyLoader,
        sliceQuery: column.meta.sliceQuery,
        extraHoverData: buildExtraHoverData(column.id),
      });
    },
    [index_type_name, PlotlyLoader, buildExtraHoverData]
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
    // TODO: Add a UI toggle to let the user choose between exporting
    // filtered rows or the complete dataset. For now, always export
    // the filtered view to match what's visible on screen.
    //
    // getDisplayRowIds() returns the row IDs currently visible in
    // ReactTable after ALL filters are applied (rowFilter +
    // filterToSearchResults). We combine this with the implicitFilter
    // to produce a single rowFilter for export that matches exactly
    // what the user sees.
    const displayRowIds = tableRef.current?.getDisplayRowIds();
    const visibleColumnIds = tableRef.current?.getVisibleColumnIds();
    // Build a Set for efficient lookup in the filter predicate
    const displayRowIdSet = displayRowIds ? new Set(displayRowIds) : null;

    const csvString = exportToCsv({
      rowFilter: (row) => {
        // Apply implicit filter (scopes the dataset itself)
        if (
          implicitFilter &&
          !filterPredicate(extendedColumns, implicitFilter)(row)
        ) {
          return false;
        }

        // Apply ReactTable's visible row set (user-visible filters + search)
        if (displayRowIds && !displayRowIdSet?.has(row.id as string)) {
          return false;
        }

        return true;
      },
      // Pass ordered IDs so export matches the current sort order
      sortedRowIds: displayRowIds ?? undefined,
      visibleColumnIds: visibleColumnIds ?? undefined,
      selectedRowIds,
    });

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
  }, [
    extendedColumns,
    index_type_name,
    downloadFilename,
    exportToCsv,
    implicitFilter,
    tableRef,
    selectedRowIds,
  ]);

  return {
    data,
    error,
    loading,
    columns: extendedColumns,
    rowFilter,
    handleClickAddColumn,
    handleClickDownload,
    handleClickFilterButton,
    rowSelection,
    setRowSelection,
    shouldShowLabelColumn,
    numFiltersApplied: Object.values(rowFilters).filter(Boolean).length,
  };
}
