import { DownloadTableData, Release } from "@depmap/data-slicer";
import React, { useMemo } from "react";
import { Tab, Tabs } from "react-bootstrap";
import styles from "src/dataPage/styles/DataPage.scss";
import DataFilePanel from "./DataFilePanel";

interface ReleaseTabsProps {
  currentReleaseData: DownloadTableData;
  release: Release;
  termsDefinitions: { [key: string]: string };
}

const ReleaseTabs = ({
  currentReleaseData,
  release,
  termsDefinitions,
}: ReleaseTabsProps) => {
  const groups: { [key: string]: any } = {};
  const releaseDataGroupedBySubtype = currentReleaseData.reduce(
    (group, option) => {
      groups[option.fileSubType.code] = group[option.fileSubType.code] || [];
      groups[option.fileSubType.code].push(option);
      return groups;
    },
    Object.create(null)
  );
  const unorderedCodes = Object.keys(releaseDataGroupedBySubtype);
  const orderedCodes = unorderedCodes.sort(
    (a, b) =>
      releaseDataGroupedBySubtype[a][0].fileSubType.position -
      releaseDataGroupedBySubtype[b][0].fileSubType.position
  );

  return (
    <Tabs
      className={styles.releaseTabs}
      defaultActiveKey={1}
      id="data_landing_page_release_tabs"
    >
      {orderedCodes.map((code: string, index: number) => (
        <Tab
          className={styles.releaseTab}
          eventKey={index}
          title={releaseDataGroupedBySubtype[code][0].fileSubType.label}
          id={code}
          key={code}
        >
          <DataFilePanel
            data={releaseDataGroupedBySubtype[code]}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      ))}
    </Tabs>
  );
};

export default ReleaseTabs;
