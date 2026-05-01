import React from "react";
import { ReleaseVersion } from "@depmap/types";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import styles from "src/dataPage/styles/DataPage.scss";
import useReleaseFileData from "src/dataPage2/hooks/useReleaseFileData";

interface Props {
  version: ReleaseVersion;
  onBack: () => void;
}

const VersionFileView = ({ version, onBack }: Props) => {
  const { files, isLoading, error } = useReleaseFileData(version.id);

  if (isLoading) return <div>Loading file data...</div>;

  const datatypes = Array.from(new Set(files.map((f) => f.datatype))).filter(
    Boolean
  );

  return (
    <div className={styles.VersionFileView}>
      <button
        className="btn btn-link"
        onClick={onBack}
        style={{ paddingLeft: 0 }}
      >
        &larr; Back to all releases
      </button>

      <header className={styles.viewHeader}>
        <h2>
          {version.release_name} <small>{version.version_name}</small>
        </h2>
        <p className={styles.description}>{version.description}</p>
      </header>

      <TabsWithHistory isLazy isManual>
        <TabList className={styles.TabList}>
          <Tab id="all">All Files</Tab>
          {datatypes.map((dt) => (
            <Tab key={dt} id={dt.toLowerCase().replace(/\s+/g, "-")}>
              {dt}
            </Tab>
          ))}
        </TabList>

        <TabPanels>
          <TabPanel>
            <DataFilePanel data={files} release={version} />
          </TabPanel>
          {datatypes.map((dt) => (
            <TabPanel key={dt}>
              <DataFilePanel
                data={files.filter((f) => f.datatype === dt)}
                release={version}
              />
            </TabPanel>
          ))}
        </TabPanels>
      </TabsWithHistory>
    </div>
  );
};

export default VersionFileView;
