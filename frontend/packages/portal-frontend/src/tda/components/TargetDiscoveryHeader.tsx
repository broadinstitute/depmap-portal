import React from "react";
import { toPortalLink } from "@depmap/globals";
import DownloadDataSvg from "src/common/components/svgs/DownloadDataSvg";
import styles from "src/tda/styles/TDASummaryPage.scss";

function TargetDiscoveryHeader() {
  return (
    <h1>
      <span>Target Discovery</span>
      {/* TODO: add link to tutorial document */}
      <form
        action={toPortalLink("/tda/table_download")}
        className={styles.headerForm}
      >
        <button type="submit" className={styles.headerButton}>
          <DownloadDataSvg />
          <span>Download TDA dataset</span>
        </button>
      </form>
    </h1>
  );
}

export default TargetDiscoveryHeader;
