import React from "react";
import { showInfoModal } from "@depmap/common-components";
import SliceTable from "@depmap/slice-table";
import { SliceQuery } from "@depmap/types";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import styles from "../../../styles/TranscriptPlotConfig.scss";

function showModelTranscriptTable(
  geneSymbol: string,
  datasetName: string,
  transcriptSlices: SliceQuery[]
) {
  const title = `Data table for gene ${geneSymbol} and ${datasetName}`;

  showInfoModal({
    title,
    modalProps: { className: styles.modal, bsSize: "large" },
    content: (
      <div className={styles.tableContainer}>
        <SliceTable
          PlotlyLoader={PlotlyLoader}
          index_type_name="depmap_model"
          getInitialState={() => ({ initialSlices: transcriptSlices })}
          downloadFilename={title}
        />
      </div>
    ),
  });
}

export default showModelTranscriptTable;
