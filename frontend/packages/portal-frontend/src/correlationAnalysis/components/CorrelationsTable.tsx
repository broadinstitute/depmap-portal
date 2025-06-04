import WideTable from "@depmap/wide-table";
import React from "react";

interface CorrelationsTableProps {
  data: any[];
  selectedRows: Set<string>;
  onChangeSelections: (selections: any[]) => void;
  compound: string;
}

export default function CorrelationsTable(props: CorrelationsTableProps) {
  const { data, selectedRows, onChangeSelections, compound } = props;
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
        data={data}
        rowHeight={40}
        allowDownloadFromTableData
        idProp="id" // TBD: confirm
        onChangeSelections={onChangeSelections}
        selectedTableLabels={selectedRows}
        hideSelectAllCheckbox
      />
    </div>
  );
}
