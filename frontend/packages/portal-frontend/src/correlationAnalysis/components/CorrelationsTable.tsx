import WideTable from "@depmap/wide-table";
import React from "react";
import { Button } from "react-bootstrap";

interface CorrelationsTableProps {
  data: any[];
}

export default function CorrelationsTable(props: CorrelationsTableProps) {
  const { data } = props;
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
        />
      </div>
    </div>
  );
}
