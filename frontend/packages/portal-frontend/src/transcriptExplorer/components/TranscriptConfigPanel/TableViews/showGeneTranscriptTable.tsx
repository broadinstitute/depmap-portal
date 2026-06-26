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
            getInitialState={() => ({
              initialSlices: [
                {
                  dataset_id: "transcript_metadata",
                  identifier: "Transcript",
                  identifier_type: "column",
                },
                {
                  dataset_id: "gene_metadata",
                  identifier: "essentiality",
                  identifier_type: "column",
                  reindex_through: {
                    dataset_id: "transcript_metadata",
                    identifier: "entrez_id",
                    identifier_type: "column",
                  },
                },
                {
                  dataset_id: "gene_metadata",
                  identifier: "selectivity",
                  identifier_type: "column",
                  reindex_through: {
                    dataset_id: "transcript_metadata",
                    identifier: "entrez_id",
                    identifier_type: "column",
                  },
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
