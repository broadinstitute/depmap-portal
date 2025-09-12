import React from "react";
import { Spinner } from "@depmap/common-components";
import { DownloadFile, Release } from "@depmap/data-slicer";
import { FileCard } from "@depmap/downloads";
import type { DeprecatedDataExplorerApiResponse } from "../../../services/deprecatedDataExplorerAPI";
import styles from "../../../styles/DimensionSelect.scss";

interface Props {
  isLoading: boolean;
  details: DeprecatedDataExplorerApiResponse["fetchDatasetDetails"] | null;
}

function DatasetDetails({ isLoading, details }: Props) {
  if (isLoading) {
    return (
      <div style={{ paddingTop: 30, width: "100%" }}>
        <Spinner left="auto" position="static" />
      </div>
    );
  }

  if (details && details.file) {
    return (
      <FileCard
        file={details.file as DownloadFile}
        release={details.release as Release}
        termsDefinitions={details.termsDefinitions}
      />
    );
  }

  if (details && !details.file) {
    return (
      <div className={styles.emptyDatasetDetails}>
        (No description could be found for this version)
      </div>
    );
  }

  return (
    <div className={styles.emptyDatasetDetails}>
      Select a version to view details
    </div>
  );
}

export default DatasetDetails;
