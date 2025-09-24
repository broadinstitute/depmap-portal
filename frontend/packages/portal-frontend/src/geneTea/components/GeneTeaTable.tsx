import styles from "../styles/GeneTea.scss";
import React from "react";
import WideTable from "@depmap/wide-table";
import PlotSpinner from "src/plot/components/PlotSpinner";

interface GeneTeaTableProps {
  error: boolean;
  isLoading: boolean;
  tableData: any;
  prefferedTableDataForDownload: any;
  tableColumns: any[];
  columnOrdering: string[];
  defaultCols: string[];
  selectedTableRows: Set<string>;
  handleChangeSelection: (selections: string[]) => void;
}

const GeneTeaTable: React.FC<GeneTeaTableProps> = ({
  error,
  isLoading,
  tableData,
  prefferedTableDataForDownload,
  tableColumns,
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
  } else if (isLoading) {
    tableContent = (
      <div className={styles.tableSpinnerContainer}>
        <PlotSpinner />
      </div>
    );
  } else {
    tableContent = (
      <div>
        <WideTable
          idProp="term"
          rowHeight={28}
          data={tableData || []}
          prefferedTableDataForDownload={prefferedTableDataForDownload || []}
          fixedHeight={500}
          columns={tableColumns}
          columnOrdering={columnOrdering}
          defaultColumnsToShow={defaultCols}
          selectedTableLabels={selectedTableRows}
          onChangeSelections={handleChangeSelection}
          hideSelectAllCheckbox
          allowDownloadFromTableDataWithMenu
          allowDownloadFromTableDataWithMenuFileName="gene-tea-data.csv"
          minimumAllowedSelections={1}
        />
      </div>
    );
  }
  return <>{tableContent}</>;
};

export default GeneTeaTable;
