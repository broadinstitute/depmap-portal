import WideTable from "@depmap/wide-table";
import React, { useMemo } from "react";
import { SortedCorrelations } from "../models/CorrelationPlot";
import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "../styles/CorrelationAnalysis.scss";

interface CorrelationsTableProps {
  isLoading: boolean;
  hasError: boolean;
  data: SortedCorrelations[];
  selectedRows: Set<string>;
  onChangeSelections: (selections: any[]) => void;
  compound: string;
}

export default function CorrelationsTable(props: CorrelationsTableProps) {
  const {
    data,
    selectedRows,
    onChangeSelections,
    compound,
    isLoading,
    hasError,
  } = props;

  // round numerical data to 4 digits in table
  const tableData = useMemo(() => {
    return data.map((cor) => {
      return {
        ...cor,
        correlation: parseFloat(cor.correlation.toFixed(4)),
        log10qvalue: parseFloat(cor.log10qvalue.toFixed(4)),
      };
    });
  }, [data]);

  const renderFilterPlaceholder = ({
    column: { filterValue, setFilter },
  }: any) => {
    return (
      <input
        type="text"
        placeholder={`Search...`}
        value={filterValue || ""}
        onChange={(event) => setFilter(event.target.value || undefined)}
        style={{ width: "90%", fontSize: "12px" }}
      />
    );
  };
  let tableContent;
  if (hasError) {
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
          columns={[
            {
              accessor: "feature",
              maxWidth: 200,
              minWidth: 150,
              Header: "Feature",
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "featureDataset",
              maxWidth: 200,
              minWidth: 150,
              Header: "Correlated Dataset",
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "dose",
              maxWidth: 200,
              minWidth: 150,
              Header: `${compound} Dose`,
              customFilter: renderFilterPlaceholder,
            },
            {
              accessor: "correlation",
              maxWidth: 200,
              minWidth: 150,
              Header: "Correlation",
              useHistoSliderFilter: true,
            },
            {
              accessor: "log10qvalue",
              maxWidth: 200,
              minWidth: 150,
              Header: "log10(q value)",
              useHistoSliderFilter: true,
            },
            {
              accessor: "rank",
              maxWidth: 200,
              minWidth: 150,
              Header: "Rank",
              customFilter: renderFilterPlaceholder,
            },
          ]}
          data={tableData}
          rowHeight={28}
          fixedHeight={500}
          idProp="id"
          onChangeSelections={onChangeSelections}
          selectedTableLabels={selectedRows}
          hideSelectAllCheckbox
          allowDownloadFromTableDataWithMenu
        />
      </div>
    );
  }

  return <>{tableContent}</>;
}
