import { DownloadTableData, Release, ReleaseType } from "@depmap/data-slicer";
import React from "react";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import styles from "src/dataPage/styles/DataPage.scss";
import { DataAvailability } from "@depmap/types";
import OverviewPanel from "src/dataPage/components/OverviewPanel";
import { allDataTabHref } from "../utils";
import CustomDownloads from "src/dataPage/components/CustomDownloads";

interface DataTabsProps {
  dataUsageUrl: string;
  allDataAvail: DataAvailability;
  releaseNotesUrl: string | null;
  forumUrl: string | null;
}
const DataTabs = ({
  dataUsageUrl,
  allDataAvail,
  releaseNotesUrl,
  forumUrl,
}: DataTabsProps) => {
  return (
    <TabsWithHistory
      className={styles.Tabs}
      onChange={() => {}}
      onSetInitialIndex={() => {}}
      isManual
      isLazy
    >
      <TabList className={styles.TabList}>
        <Tab id="overview" className={styles.Tab}>
          Overview
        </Tab>
        <Tab id="allData" className={styles.Tab}>
          Download Files
        </Tab>
        <Tab id="customDownloads" className={styles.Tab}>
          Custom Downloads
        </Tab>
      </TabList>

      <TabPanels className={styles.TabPanels}>
        <TabPanel className={styles.TabPanel}>
          {" "}
          {allDataAvail && (
            <OverviewPanel
              allDataAvail={allDataAvail}
              releaseNotesUrl={releaseNotesUrl}
              forumUrl={forumUrl}
              currentReleaseCitation={null}
            />
          )}
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          {/* NEW Download files tab should go here */}
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          <div className={styles.header}>
            <h2>Create and download a customized dataset</h2>
            <div className={styles.tabDescription}>
              Custom Downloads allows you to download your dataset of interest
              subsetted for your customized context. If you&apos;re looking to
              download the entire dataset, visit our{" "}
              <a
                className={styles.dataPageLink}
                href={allDataTabHref}
                target="_blank"
                rel="noreferrer"
              >
                Download Files page{" "}
                {/*Link to new tab. Should we keep the tab id and therefore href the same to avoid breaking old links?*/}
              </a>
              .
            </div>
          </div>
          {/* TODO!!! The new UI is supposed to avoid downloading 
          everything all at once. Revisit how CustomDownloads gets the 
          allDownloads data. Likely allDownlaods contains more than it needs */}
          {/*<CustomDownloads allDownloads={allDownloads} />*/}
        </TabPanel>
      </TabPanels>
    </TabsWithHistory>
  );
};

export default DataTabs;
