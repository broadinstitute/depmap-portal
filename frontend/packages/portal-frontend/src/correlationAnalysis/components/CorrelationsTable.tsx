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
          { accessor: "feature", Header: "Feature" },
          { accessor: "featureDataset", Header: "Correlated Dataset" },
          { accessor: "dose", Header: `${compound} Dose` },
          { accessor: "correlation", Header: "Correlation" },
          { accessor: "log10qvalue", Header: "log10(q value)" },
          { accessor: "rank", Header: "Rank" },
        ]}
        data={tableData}
        rowHeight={40}
        allowDownloadFromTableData
        idProp="id"
        onChangeSelections={onChangeSelections}
        selectedTableLabels={selectedRows}
        hideSelectAllCheckbox
      />
    </div>
  );
}
