import React from "react";
import { showInfoModal } from "@depmap/common-components";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import SliceTable from "@depmap/slice-table";
import { SliceQuery } from "@depmap/types";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import styles from "../../../styles/TranscriptPlotConfig.scss";

function showModelTranscriptTable(
  geneSymbol: string,
  datasetName: string,
  transcriptSlices: SliceQuery[]
) {
  const title = `Model/Transcript table for gene ${geneSymbol} and ${datasetName}`;

  showInfoModal({
    title,
    modalProps: { className: styles.modal, bsSize: "large" },
    content: (
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <div className={styles.tableContainer}>
          <SliceTable
            index_type_name="depmap_model"
            getInitialState={() => ({ initialSlices: transcriptSlices })}
            downloadFilename={title}
          />
        </div>
      </PlotlyLoaderProvider>
    ),
  });
}

export default showModelTranscriptTable;
