import React from "react";
import SliceTable from "@depmap/slice-table";

function EmbeddedTable() {
  return (
    <SliceTable
      index_type_name="depmap_model"
      getInitialState={() => ({
        initialSlices: [
          {
            dataset_id: "depmap_model_metadata",
            identifier_type: "column",
            identifier: "Age",
          },
          {
            dataset_id: "depmap_model_metadata",
            identifier_type: "column",
            identifier: "AgeCategory",
          },
          {
            dataset_id: "depmap_model_metadata",
            identifier_type: "column",
            identifier: "OncotreeLineage",
          },
        ],
      })}
    />
  );
}

export default EmbeddedTable;
