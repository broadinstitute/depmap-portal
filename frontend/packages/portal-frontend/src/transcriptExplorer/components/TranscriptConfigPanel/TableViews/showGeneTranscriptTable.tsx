import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  loadRememberedColumns,
  rememberColumns,
} from "@depmap/data-explorer-2";
import SliceTable from "@depmap/slice-table";
import { showInfoModal } from "@depmap/common-components";
import { SliceQuery } from "@depmap/types";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import styles from "../../../styles/TranscriptPlotConfig.scss";

const METADATA_DATASET = "transcript_metadata";
const GENE_COLUMN = "Gene";

// Its own scope, not the expansion member picker's, even though both are tables
// of transcripts: this one is all about annotations and has a wide modal to show
// them in, while that one spends its width on statistics. See
// RememberedColumnsScope.
const COLUMNS_SCOPE = "gene-transcripts";

// What the table opens with the first time, before anyone has curated it. The
// transcript's own name — the rest of the columns are the point of the modal,
// but which ones are useful is a question only the reader can answer.
const DEFAULT_SLICES: SliceQuery[] = [
  {
    dataset_id: METADATA_DATASET,
    identifier: "Transcript",
    identifier_type: "column",
  },
];

// The transcripts of one gene, in a table.
//
// Scoped by resolving the gene's transcripts up front and filtering on id,
// rather than by having `implicitFilter` read the Gene column through
// `getValue`. That reads as the more direct way to write it and does not work:
// `getValue` resolves against the table's LOADED columns (see its own comment in
// @depmap/slice-table), so a column nobody asked to display is never fetched and
// comes back undefined -- which compares equal to no gene at all, and the table
// silently shows nothing. Loading Gene as a column would fix it too, at the cost
// of a column repeating the same symbol on every row of a modal already titled
// with it.
//
// Filtering on id is also what every other implicitFilter in the codebase does.
function GeneTranscriptTable({
  geneSymbol,
  title,
}: {
  geneSymbol: string;
  title: string;
}) {
  // Null until resolved, which is also what drives `isLoading` below. An empty
  // Set would be indistinguishable from "this gene has no transcripts" and would
  // flash an empty table on the way to a full one.
  const [transcriptIds, setTranscriptIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    setTranscriptIds(null);

    cached(breadboxAPI)
      .getTabularDatasetData(METADATA_DATASET, { columns: [GENE_COLUMN] })
      .then((wrapper) => {
        if (cancelled) {
          return;
        }

        const column = wrapper[GENE_COLUMN] ?? {};

        setTranscriptIds(
          new Set(Object.keys(column).filter((id) => column[id] === geneSymbol))
        );
      })
      .catch((e) => {
        window.console.error(e);

        // An empty set rather than a permanent spinner: the table then renders
        // its own empty state, which is a worse answer than the real one but a
        // better one than a modal that never finishes loading.
        if (!cancelled) {
          setTranscriptIds(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [geneSymbol]);

  return (
    <div className={styles.tableContainer}>
      <SliceTable
        PlotlyLoader={PlotlyLoader}
        index_type_name="transcript"
        downloadFilename={title}
        isLoading={transcriptIds === null}
        getInitialState={() => ({
          // `??`, not `||`: an empty remembered set means someone closed every
          // column on purpose, and reopening to the defaults would read as the
          // table refusing to stay closed.
          initialSlices:
            loadRememberedColumns(COLUMNS_SCOPE, "transcript") ??
            DEFAULT_SLICES,
        })}
        onChangeSlices={(nextSlices) =>
          rememberColumns(COLUMNS_SCOPE, "transcript", nextSlices)
        }
        implicitFilter={({ id }) => Boolean(transcriptIds?.has(id))}
      />
    </div>
  );
}

function showGeneTranscriptTable(geneSymbol: string) {
  const title = `Transcript annotations for gene ${geneSymbol}`;

  showInfoModal({
    title,
    modalProps: { className: styles.modal, bsSize: "large" },
    content: <GeneTranscriptTable geneSymbol={geneSymbol} title={title} />,
  });
}

export default showGeneTranscriptTable;
