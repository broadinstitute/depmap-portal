import React from "react";
import { showInfoModal } from "@depmap/common-components";
import { DataExplorerPlotResponse, EntityRefSet } from "@depmap/types";

function showExpandedSelectionsTable(
  data: DataExplorerPlotResponse,
  selection: EntityRefSet
) {
  showInfoModal({
    title: "Selected pairs",
    content: (
      <pre style={{ maxHeight: 400, overflow: "auto" }}>
        {JSON.stringify(selection, null, 2)}
      </pre>
    ),
  });
}

export default showExpandedSelectionsTable;
