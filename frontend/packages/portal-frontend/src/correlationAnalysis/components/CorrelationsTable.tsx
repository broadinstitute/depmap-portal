import WideTable from "@depmap/wide-table";
import React, { useMemo } from "react";
import { SortedCorrelations } from "../models/CorrelationPlot";

interface CorrelationsTableProps {
  data: SortedCorrelations[];
  selectedRows: Set<string>;
  onChangeSelections: (selections: any[]) => void;
  compound: string;
}

export default function CorrelationsTable(props: CorrelationsTableProps) {
  const { data, selectedRows, onChangeSelections, compound } = props;

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

  return (
    <div>
      <WideTable
        columns={[
          {
            accessor: "feature",
            maxWidth: 200,
            minWidth: 150,
            Header: "Feature",
          },
          {
            accessor: "featureDataset",
            maxWidth: 200,
            minWidth: 150,
            Header: "Correlated Dataset",
          },
          {
            accessor: "dose",
            maxWidth: 200,
            minWidth: 150,
            Header: `${compound} Dose`,
          },
          {
            accessor: "correlation",
            maxWidth: 200,
            minWidth: 150,
            Header: "Correlation",
          },
          {
            accessor: "log10qvalue",
            maxWidth: 200,
            minWidth: 150,
            Header: "log10(q value)",
          },
          { accessor: "rank", maxWidth: 200, minWidth: 150, Header: "Rank" },
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
