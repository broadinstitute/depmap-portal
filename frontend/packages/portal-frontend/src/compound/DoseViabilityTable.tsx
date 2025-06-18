import React from "react";
import WideTable from "@depmap/wide-table";
import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "./CompoundDoseCurves.scss";

interface DoseViabilityTableProps {
  error: boolean;
  isLoading: boolean;
  doseTable: any[] | null;
  memoizedTableData: any[];
  doseCurveTableColumns: any[];
  columnOrdering: string[];
  defaultCols: string[];
  selectedTableRows: Set<string>;
  handleChangeSelection: (selections: string[]) => void;
}

const DoseViabilityTable: React.FC<DoseViabilityTableProps> = ({
  error,
  isLoading,
  doseTable,
  memoizedTableData,
  doseCurveTableColumns,
  columnOrdering,
  defaultCols,
  selectedTableRows,
  handleChangeSelection,
}) => {
  let tableContent;
  if (error) {
    tableContent = (
      <div className={styles.errorMessage}>Error loading table data.</div>
    );
  } else if (isLoading || !doseTable) {
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
          data={memoizedTableData}
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
