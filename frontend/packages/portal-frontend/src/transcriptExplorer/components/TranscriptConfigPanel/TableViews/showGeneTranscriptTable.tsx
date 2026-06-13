import React from "react";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import SliceTable from "@depmap/slice-table";
import { showInfoModal } from "@depmap/common-components";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import styles from "../../../styles/TranscriptPlotConfig.scss";

function showGeneTranscriptTable(geneSymbol: string) {
  const title = `Transcript table for gene ${geneSymbol}`;

  showInfoModal({
    title,
    modalProps: { className: styles.modal, bsSize: "large" },
    content: (
      <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
        <div className={styles.tableContainer}>
          <SliceTable
            index_type_name="transcript"
            downloadFilename={title}
            renderCustomActions={() => {
              return (
                <div className={styles.geneAnnotationNote}>
                  <div>
                    ⬅ <b>Note</b>:
                  </div>
                  <div>
                    <span>
                      Adding gene-level annotations is currently broken 😢
                    </span>
                    <span> </span>
                    <span>But you can still add data columns.</span>
                  </div>
                </div>
              );
            }}
            getInitialState={() => ({
              initialSlices: [
                {
                  dataset_id: "transcript_metadata",
                  identifier: "Gene",
                  identifier_type: "column",
                },
                {
                  dataset_id: "transcript_metadata",
                  identifier: "Transcript",
                  identifier_type: "column",
                },
              ],
            })}
            implicitFilter={({ getValue }) =>
              geneSymbol ===
              getValue({
                dataset_id: "transcript_metadata",
                identifier: "Gene",
                identifier_type: "column",
              })
            }
          />
        </div>
      </PlotlyLoaderProvider>
    ),
  });
}

export default showGeneTranscriptTable;
