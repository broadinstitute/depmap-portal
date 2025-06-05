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
import { DataAvailability } from "../models/types";
import { AllData } from "./AllData";
import CurrentReleasePanel from "./CurrentReleasePanel";
import CustomDownloads from "./CustomDownloads";
import OverviewPanel from "./OverviewPanel";
import { allDataTabHref } from "./utils";

interface DataTabsProps {
  allDownloads: DownloadTableData;
  currentReleaseData: DownloadTableData;
  releaseData: Release[];
  releaseTypes: ReleaseType[];
  fileTypes: string[];
  sources: string[];
  dataUsageUrl: string;
  currentReleaseDataAvail: DataAvailability;
  allDataAvail: DataAvailability;
  termsDefinitions: { [key: string]: string };
  releaseNotesUrl: string | null;
  forumUrl: string | null;
}
const DataTabs = ({
  allDownloads,
  currentReleaseData,
  releaseData,
  releaseTypes,
  fileTypes,
  sources,
  dataUsageUrl,
  currentReleaseDataAvail,
  allDataAvail,
  termsDefinitions,
  releaseNotesUrl,
  forumUrl,
}: DataTabsProps) => {
  const currentRelease = releaseData.filter(
    (r) => r.releaseName === currentReleaseData[0].releaseName
  )[0];

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
        <Tab id="currentRelease" className={styles.Tab}>
          Current Release
        </Tab>
        <Tab id="customDownloads" className={styles.Tab}>
          Custom Downloads
        </Tab>
        <Tab id="allData" className={styles.Tab}>
          All Data
        </Tab>
      </TabList>

      <TabPanels className={styles.TabPanels}>
        <TabPanel className={styles.TabPanel}>
          {" "}
          {allDataAvail && currentRelease && (
            <OverviewPanel
              allDataAvail={allDataAvail}
              releaseNotesUrl={releaseNotesUrl}
              forumUrl={forumUrl}
              currentReleaseCitation={currentRelease.citation}
            />
          )}
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          {currentRelease &&
            currentReleaseData &&
            currentReleaseData.length > 0 && (
              <CurrentReleasePanel
                currentReleaseData={currentReleaseData}
                release={currentRelease}
                currentReleaseDataAvail={currentReleaseDataAvail}
                termsDefinitions={termsDefinitions}
                releaseNotesUrl={releaseNotesUrl}
              />
            )}
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
                All Data page
              </a>
              .
            </div>
          </div>
          <CustomDownloads allDownloads={allDownloads} />
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          <div className={styles.header}>
            <h2>All Data Downloads</h2>
            <div className={styles.tabDescription}>
              Browse and access the complete collection of files visible in the
              DepMap portal. Select file sets using the drop downs, or search
              for specific files by name.
            </div>
          </div>
          {allDownloads.length > 0 && releaseData.length > 0 && (
            <AllData
              downloadTable={allDownloads}
              releaseData={releaseData}
              releaseTypes={releaseTypes}
              termsDefinitions={termsDefinitions}
              fileTypes={fileTypes}
              sources={sources}
              dataUsageUrl={dataUsageUrl}
            />
          )}
        </TabPanel>
      </TabPanels>
    </TabsWithHistory>
  );
};

export default DataTabs;
