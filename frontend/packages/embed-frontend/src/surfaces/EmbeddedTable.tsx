import React from "react";
import SliceTable from "@depmap/slice-table";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2/src/contexts/PlotlyLoaderContext";
import DensityAndBarchartLoader from "../loaders/DensityAndBarchartLoader";
import { readSliceQuerySetFromQueryString } from "../utils/parseSliceQuerySet";

import "bootstrap/dist/css/bootstrap.css";
import "../index.scss";
import styles from "../styles/EmbeddedTable.scss";

const filenameWithTimestamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    "delphi-" +
    now.getFullYear() +
    [now.getMonth() + 1, now.getDate()].map(pad).join("")
  );
};

let config: ReturnType<typeof readSliceQuerySetFromQueryString>;
let error: string | undefined;

try {
  config = readSliceQuerySetFromQueryString();
} catch (e) {
  error = (e as any).toString();
}

function EmbeddedTable() {
  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <PlotlyLoaderProvider PlotlyLoader={DensityAndBarchartLoader}>
      <div className={styles.tableContainer}>
        <SliceTable
          index_type_name={config.dimension_type}
          downloadFilename={filenameWithTimestamp()}
          getInitialState={() => ({ initialSlices: config.slices })}
        />
      </div>
    </PlotlyLoaderProvider>
  );
}

export default EmbeddedTable;
