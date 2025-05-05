import WideTable from "@depmap/wide-table";
import React from "react";
import { Button } from "react-bootstrap";

interface CorrelationsTableProps {
  data: any[];
  selectedRows: Set<string>;
  onChangeSelections: (selections: any[]) => void;
}

export default function CorrelationsTable(props: CorrelationsTableProps) {
  const { data, selectedRows, onChangeSelections } = props;
  return (
    <div>
      <div
        style={{ display: "flex", justifyContent: "flex-end", padding: "10px" }}
      >
        <Button active>CSV</Button>
      </div>

      <div style={{ height: "auto" }}>
        <WideTable
          columns={[
            { accessor: "Feature" },
            { accessor: "Feature Type" },
            { accessor: "imatinib Dose" },
            { accessor: "Correlation Coefficient" },
            { accessor: "-log10 qval" },
            { accessor: "Rank" },
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
    </div>
  );
}
