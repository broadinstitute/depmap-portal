import React from "react";
import { Markdown, Spinner } from "@depmap/common-components";
import styles from "../../../styles/DimensionSelect.scss";

interface Props {
  isLoading: boolean;
  // `undefined` represents no selection.
  // `null` means a selection has been made but that dataset has no description.
  description: string | undefined | null;
}

function DatasetDetails({ isLoading, description }: Props) {
  if (isLoading) {
    return (
      <div style={{ paddingTop: 30, width: "100%" }}>
        <Spinner left="auto" position="static" />
      </div>
    );
  }

  if (description) {
    return (
      <Markdown className={styles.DataVersionMarkdown}>{description}</Markdown>
    );
  }

  if (description === null) {
    return (
      <div className={styles.emptyDatasetDetails}>
        <span
          className="glyphicon glyphicon-exclamation-sign"
          aria-hidden="true"
        />
        <span>No description could be found for this version.</span>
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
