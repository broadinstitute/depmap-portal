import React from "react";
import styles from "src/dataPage/styles/DataPage.scss";
import MainTabs from "./MainTabs";

interface DataPageV2Props {
  releaseNotesUrl: string | null;
  forumUrl: string | null;
}

export const DataPageV2 = ({ releaseNotesUrl, forumUrl }: DataPageV2Props) => {
  return (
    <div className={styles.DataPage}>
      <header className={styles.header}>
        <h1>Data</h1>
        <p>
          Browse and access the complete collection of datasets available in the
          DepMap portal.
        </p>
      </header>
      <main className={styles.main}>
        <MainTabs releaseNotesUrl={releaseNotesUrl} forumUrl={forumUrl} />
      </main>
    </div>
  );
};

export default DataPageV2;
