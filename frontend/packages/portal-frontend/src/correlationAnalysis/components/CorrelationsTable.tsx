import WideTable from "@depmap/wide-table";
import React from "react";
import { Button } from "react-bootstrap";

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
      <div style={{ height: "auto" }}>
        <WideTable
          columns={[
            { accessor: "Feature" },
            { accessor: "Feature Type" },
            { accessor: "Dose", Header: `${compound} Dose` },
            { accessor: "Correlation Coefficient" },
            { accessor: "-log10 qval", Header: "-log10(q value)" },
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
