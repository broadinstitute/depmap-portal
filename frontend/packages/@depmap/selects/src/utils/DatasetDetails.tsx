import React, { useEffect, useRef, useState } from "react";
import cx from "classnames";
import { Markdown, Spinner } from "@depmap/common-components";
import styles from "../styles/DatasetDetails.scss";

interface Props {
  isLoading: boolean;
  // `undefined` represents no selection.
  // `null` means a selection has been made but that dataset has no description.
  description: string | undefined | null;
}

function DatasetDetails({ isLoading, description }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(300);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const container = ref.current;

    const measure = () => {
      const child = container?.firstChild as HTMLElement | null;
      if (!child?.classList?.contains("markdown-body")) return false;

      const minHeight = 300;
      const maxHeight = window.innerHeight - 209;
      setHeight(Math.max(minHeight, Math.min(maxHeight, child.scrollHeight)));
      return true;
    };

    const observer = new MutationObserver(() => {
      if (measure()) {
        observer.disconnect();
      }
    });

    if (container) {
      observer.observe(container, { childList: true, subtree: true });
      measure();
    }

    // eslint-disable-next-line consistent-return
    return () => observer.disconnect();
  }, [isLoading]);

  if (isLoading) {
    return (
      <div
        className={cx(styles.DatasetDetails, { [styles.isLoading]: isLoading })}
      >
        <div className={styles.spinner}>
          <Spinner position="static" />
        </div>
      </div>
    );
  }

  if (description) {
    return (
      <div ref={ref} className={styles.DatasetDetails} style={{ height }}>
        <Markdown className={styles.DataVersionMarkdown}>
          {description}
        </Markdown>
      </div>
    );
  }

  if (description === null) {
    return (
      <div className={styles.DatasetDetails}>
        <div className={styles.emptyDatasetDetails}>
          <span
            className="glyphicon glyphicon-exclamation-sign"
            aria-hidden="true"
          />
          <span>No description could be found for this version.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.DatasetDetails}>
      <div className={styles.emptyDatasetDetails}>
        Select a version to view details
      </div>
    </div>
  );
}

export default DatasetDetails;
