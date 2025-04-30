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

  // We want these file sub types to always be first
  const order = [
    "model_conditions_mapping",
    "crispr_screen",
    "drug_screen",
    "copy_number",
    "mutations",
    "expression",
    "fusions",
  ];

  // We always want the readme data last
  const readMeData = useMemo(() => {
    return currentReleaseData.find(
      (file) => file.fileSubType.code === "read_me"
    );
  }, [currentReleaseData]);

  // Any amount of additional file sub type sections as defined in the yaml sub_type
  // can exist between the original ordered data and read_me
  const additionalDataGroups = currentReleaseData
    .filter(
      (file) =>
        !order.includes(file.fileSubType.code) &&
        file.fileSubType.code !== "read_me"
    )
    .map((file) => file.fileSubType.code);

  const uniqueAdditionalDataGroups = Array.from(new Set(additionalDataGroups));

  return (
    <Tabs
      className={styles.releaseTabs}
      defaultActiveKey={1}
      id="data_landing_page_release_tabs"
    >
      {order.map((dataTypeKey: string, index: number) => (
        <Tab
          className={styles.releaseTab}
          eventKey={index}
          title={releaseDataGroupedBySubtype[dataTypeKey][0].fileSubType.label}
          id={dataTypeKey}
          key={dataTypeKey}
        >
          <DataFilePanel
            data={releaseDataGroupedBySubtype[dataTypeKey]}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      ))}
      {uniqueAdditionalDataGroups.map((dataTypeKey: string, index: number) => (
        <Tab
          className={styles.releaseTab}
          eventKey={order.length + index}
          title={releaseDataGroupedBySubtype[dataTypeKey][0].fileSubType.label}
          id={dataTypeKey}
          key={dataTypeKey}
        >
          <DataFilePanel
            data={releaseDataGroupedBySubtype[dataTypeKey]}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      ))}
      {readMeData && (
        <Tab
          className={styles.releaseTab}
          eventKey={order.length + uniqueAdditionalDataGroups.length + 1}
          title={readMeData.fileSubType.label}
        >
          <DataFilePanel
            data={[readMeData]}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
    </Tabs>
  );
};

export default ReleaseTabs;
