import React from "react";
import { toPortalLink } from "@depmap/globals";
import DownloadDataSvg from "src/common/components/svgs/DownloadDataSvg";
import ResistanceScreenTable from "./ResistanceScreenTable";
import styles from "src/pairedScreens/styles/sharedDashboard.scss";

function ResistanceScreenDashboard() {
  return (
    <div>
      <div className={styles.header}>
        <h2>Resistance Screen Dashboard</h2>
        <span className={styles.download}>
          <DownloadDataSvg />
          <a
            target="_blank"
            rel="noreferrer"
            href={toPortalLink(
              "data_page/?" +
                new URLSearchParams({
                  tab: "allData",
                  releasename: "Resistance Screens 26Q1",
                  filename: "PairedResScreenTable.csv",
                }).toString()
            )}
          >
            Download files
          </a>
        </span>
      </div>
      <div className={styles.description}>
        <p>
          This dashboard will help you navigate the CRISPR drug resistance
          screens which have data analyzed and loaded into the portal.
        </p>
        <p>
          <b>Note</b>: the gene effects shown in the scatter plot are from
          co-processing all screens with Chronos (ScreenGeneEffect), whereas the
          Chronos-compare volcano plots are from processing each resistance
          screen individually. As a result, the differential effect size in the
          volcano plot should be similar but not exactly the same as the
          difference shown in the scatter plot.
        </p>
      </div>
      <div className={styles.tableContainer}>
        <ResistanceScreenTable />
      </div>
    </div>
  );
}

export default ResistanceScreenDashboard;
