import { DownloadTableData, FileSubType, Release } from "@depmap/data-slicer";
import React from "react";
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
      groups[option.fileSubType] = group[option.fileSubType] || [];
      groups[option.fileSubType].push(option);
      return groups;
    },
    Object.create(null)
  );

  const modelAndConditionsData =
    releaseDataGroupedBySubtype[FileSubType.model_conditions_mapping];
  const crisprScreenData =
    releaseDataGroupedBySubtype[FileSubType.crispr_screen];
  const drugScreenData = releaseDataGroupedBySubtype[FileSubType.drug_screen];
  const copyNumberData = releaseDataGroupedBySubtype[FileSubType.copy_number];
  const mutationsData = releaseDataGroupedBySubtype[FileSubType.mutations];
  const expressionData = releaseDataGroupedBySubtype[FileSubType.expression];
  const fusionsData = releaseDataGroupedBySubtype[FileSubType.fusions];
  const globalGenomicFeatureData =
    releaseDataGroupedBySubtype[FileSubType.global_genomic_features];
  const readMeData = releaseDataGroupedBySubtype[FileSubType.read_me];

  return (
    <Tabs
      className={styles.releaseTabs}
      defaultActiveKey={1}
      id="data_landing_page_release_tabs"
    >
      {modelAndConditionsData && (
        <Tab
          className={styles.releaseTab}
          eventKey={1}
          title={FileSubType.model_conditions_mapping}
          id={"mapping-files"}
        >
          <DataFilePanel
            data={modelAndConditionsData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {crisprScreenData && (
        <Tab
          className={styles.releaseTab}
          eventKey={2}
          title={FileSubType.crispr_screen}
        >
          <DataFilePanel
            data={crisprScreenData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {drugScreenData && (
        <Tab
          className={styles.releaseTab}
          eventKey={3}
          title={FileSubType.drug_screen}
        >
          <DataFilePanel
            data={drugScreenData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {copyNumberData && (
        <Tab
          className={styles.releaseTab}
          eventKey={4}
          title={FileSubType.copy_number}
        >
          <DataFilePanel
            data={copyNumberData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {mutationsData && (
        <Tab
          className={styles.releaseTab}
          eventKey={5}
          title={FileSubType.mutations}
        >
          <DataFilePanel
            data={mutationsData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {expressionData && (
        <Tab
          className={styles.releaseTab}
          eventKey={6}
          title={FileSubType.expression}
        >
          <DataFilePanel
            data={expressionData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {fusionsData && (
        <Tab
          className={styles.releaseTab}
          eventKey={7}
          title={FileSubType.fusions}
        >
          <DataFilePanel
            data={fusionsData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {globalGenomicFeatureData && (
        <Tab
          className={styles.releaseTab}
          eventKey={7}
          title={FileSubType.global_genomic_features}
        >
          <DataFilePanel
            data={globalGenomicFeatureData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
      {readMeData && (
        <Tab
          className={styles.releaseTab}
          eventKey={8}
          title={FileSubType.read_me}
        >
          <DataFilePanel
            data={readMeData}
            termsDefinitions={termsDefinitions}
            release={release}
          />
        </Tab>
      )}
    </Tabs>
  );
};

export default ReleaseTabs;
