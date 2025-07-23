import React, { useCallback, useMemo } from "react";
import WideTable from "@depmap/wide-table";
import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "./CompoundDoseViability.scss";
import { TableFormattedData } from "./types";

interface DoseViabilityTableProps {
  error: boolean;
  isLoading: boolean;
  tableData: TableFormattedData;
  doseCurveTableColumns: any[];
  columnOrdering: string[];
  defaultCols: string[];
  selectedTableRows: Set<string>;
  handleChangeSelection: (selections: string[]) => void;
}

const DoseViabilityTable: React.FC<DoseViabilityTableProps> = ({
  error,
  isLoading,
  tableData,
  doseCurveTableColumns,
  columnOrdering,
  defaultCols,
  selectedTableRows,
  handleChangeSelection,
}) => {
  const roundedTableData = useMemo(
    () =>
      tableData
        ? tableData.map((row) => {
            const newRow = { ...row };
            Object.keys(newRow).forEach((key) => {
              const val = (newRow as Record<string, any>)[key];
              if (typeof val === "number" && !Number.isNaN(val)) {
                (newRow as Record<string, any>)[key] =
                  Math.round(val * 10000) / 10000;
              }
            });
            return newRow;
          })
        : [],
    [tableData]
  );

  const getSortedTableDataWithSelectionsOnTop = useCallback(
    (
      table: {
        [x: `${number} uM`]: any;
        modelId: string;
        cellLine: string;
        auc: number;
      }[]
    ) => {
      // Selected rows at the top, in order of selection, then the rest in original order
      const selectedIds = Array.from(selectedTableRows);

      const selected = selectedIds
        .map((id) => table.find((row) => row.modelId === id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      const unselected = table.filter(
        (row) => !selectedTableRows.has(row.modelId)
      );
      return [...selected, ...unselected];
    },
    [selectedTableRows]
  );

  const sortByAucTableData = useMemo(() => {
    if (!roundedTableData) return [];
    const sortedByAUCData = roundedTableData.sort((a, b) => a.auc - b.auc);
    return roundedTableData && selectedTableRows.size > 0
      ? getSortedTableDataWithSelectionsOnTop(sortedByAUCData)
      : sortedByAUCData;
  }, [roundedTableData, selectedTableRows]);

  let tableContent;
  if (error) {
    tableContent = (
      <div className={styles.errorMessage}>Error loading table data.</div>
    );
  } else if (isLoading || !sortByAucTableData) {
    tableContent = (
      <div className={styles.tableSpinnerContainer}>
        <PlotSpinner />
      </div>
    );
  } else {
    tableContent = (
      <div>
        <WideTable
          idProp="modelId"
          rowHeight={28}
          data={sortByAucTableData}
          fixedHeight={500}
          columns={doseCurveTableColumns}
          columnOrdering={columnOrdering}
          defaultColumnsToShow={defaultCols}
          selectedTableLabels={selectedTableRows}
          onChangeSelections={handleChangeSelection}
          hideSelectAllCheckbox
          allowDownloadFromTableDataWithMenu
          allowDownloadFromTableDataWithMenuFileName="dose-data.csv"
        />
      </div>
    );
  }
  return <>{tableContent}</>;
};

export default DoseViabilityTable;
