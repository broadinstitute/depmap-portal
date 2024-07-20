import React from "react";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import TableData from "src/common/components/CharacterizationDataTable";

import CellLineOverview from "./CellLineOverview";
import styles from "../styles/CellLinePage.scss";

interface Props {
  modelId: string;
  hasMetMapData: boolean;
}

const CellLinePageTabs = ({ modelId, hasMetMapData }: Props) => {
  return (
    <TabsWithHistory
      className={styles.Tabs}
      isManual
      isLazy
      lazyBehavior="keepMounted"
    >
      <TabList className={styles.TabList}>
        <Tab id="overview">Overview</Tab>
        <Tab id="mutations">Mutations</Tab>
        <Tab id="fusions">Fusions</Tab>
        <Tab id="translocations">Translocations</Tab>
      </TabList>

      <TabPanels className={styles.TabPanels}>
        <TabPanel className={styles.TabPanel}>
          <CellLineOverview modelId={modelId} hasMetMapData={hasMetMapData} />
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          <TableData
            id={modelId}
            physicalUnit="cell_line"
            characterization="mutations"
          />
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          <TableData
            id={modelId}
            physicalUnit="cell_line"
            characterization="fusions"
          />
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          <TableData
            id={modelId}
            physicalUnit="cell_line"
            characterization="translocations"
          />
        </TabPanel>
      </TabPanels>
    </TabsWithHistory>
  );
};

export default CellLinePageTabs;
