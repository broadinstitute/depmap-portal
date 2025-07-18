import React, { useMemo } from "react";
import WideTable from "@depmap/wide-table";
import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "./CompoundDoseViability.scss";
import { TableFormattedData } from "./types";

interface DoseViabilityTableProps {
  error: boolean;
  isLoading: boolean;
  sortedTableData: TableFormattedData;
  doseCurveTableColumns: any[];
  columnOrdering: string[];
  defaultCols: string[];
  selectedTableRows: Set<string>;
  handleChangeSelection: (selections: string[]) => void;
}

const DoseViabilityTable: React.FC<DoseViabilityTableProps> = ({
  error,
  isLoading,
  sortedTableData,
  doseCurveTableColumns,
  columnOrdering,
  defaultCols,
  selectedTableRows,
  handleChangeSelection,
}) => {
  const roundedTableData = useMemo(
    () =>
      sortedTableData
        ? sortedTableData.map((row) => {
            const newRow = { ...row };
            Object.keys(newRow).forEach((key) => {
              const val = (newRow as Record<string, any>)[key];
              if (typeof val === "number" && !Number.isNaN(val)) {
                (newRow as Record<string, any>)[key] =
                  Math.round(val * 1000) / 1000;
              }
            });
            return newRow;
          })
        : [],
    [sortedTableData]
  );

  let tableContent;
  if (error) {
    tableContent = (
      <div className={styles.errorMessage}>Error loading table data.</div>
    );
  } else if (isLoading || !sortedTableData) {
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
          data={roundedTableData}
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
