import React from "react";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import styles from "../styles/ContextExplorer.scss";
import {
  CellLineOverview,
  ContextNameInfo,
  ContextSummary,
  TabTypes,
} from "../models/types";
import ContextExplorerPlot from "src/contextExplorer/components/ContexExplorerPlot";
import OverviewTable from "src/contextExplorer/components/OverviewTable";
import { capitalizeFirstLetter } from "../utils";
import ContextAnalysis from "src/contextExplorer/components/contextAnalysis/ContextAnalysis";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {
  selectedContextNameInfo: ContextNameInfo;
  selectedContextData: ContextSummary;
  checkedDataValues: number[][];
  checkedDatatypes: Set<string>;
  updateDatatypeSelection: (clicked: string) => void;
  topContextNameInfo: ContextNameInfo;
  overlappingDepmapIds: string[];
  overviewTableData: { [key: string]: any }[];
  getCellLineUrlRoot: () => Promise<string>;
  handleSetSelectedTab: (tabType: TabTypes) => void;
  customInfoImg: React.JSX.Element;
  handleSetPlotElement: (element: any) => void;
  plotElement: ExtendedPlotType | null;
}

const ContextExplorerTabs = ({
  selectedContextNameInfo,
  selectedContextData,
  checkedDataValues,
  checkedDatatypes,
  updateDatatypeSelection,
  topContextNameInfo,
  overlappingDepmapIds,
  overviewTableData,
  getCellLineUrlRoot,
  handleSetSelectedTab,
  customInfoImg,
  handleSetPlotElement,
  plotElement,
}: Props) => {
  // Filters table data accoding to the selected context's depmap_ids
  const filteredData = overviewTableData.filter((row) => {
    return selectedContextData.all_depmap_ids.some(
      (a) => a[1] === row.depmap_id
    );
  });

  const formattedFilteredData: CellLineOverview[] = filteredData.map((row) => {
    return {
      depmapId: row.depmap_id,
      cellLineDisplayName: row.cell_line_display_name,
      lineage: row.lineage,
      primaryDisease: row.primary_disease,
      subtype: row.subtype,
      molecularSubtype: row.molecular_subtype,
      crispr: capitalizeFirstLetter(String(row.crispr)),
      rnai: capitalizeFirstLetter(String(row.rnai)),
      wgs: capitalizeFirstLetter(String(row.wgs)),
      wes: capitalizeFirstLetter(String(row.wes)),
      rna_seq: capitalizeFirstLetter(String(row.rna_seq)),
      prism: capitalizeFirstLetter(String(row.prism)),
    };
  });

  return (
    <TabsWithHistory
      className={styles.Tabs}
      onChange={(index) => handleSetSelectedTab(index)}
      onSetInitialIndex={(index) => handleSetSelectedTab(index)}
      isManual
      isLazy
    >
      <TabList className={styles.TabList}>
        <Tab id="overview" className={styles.Tab}>
          Overview
        </Tab>
        <Tab id="geneDependency" className={styles.Tab}>
          Gene Dependency
        </Tab>
        <Tab id="drugSensitivity" className={styles.Tab}>
          Drug Sensitivity
        </Tab>
      </TabList>

      <TabPanels className={styles.TabPanels}>
        <TabPanel className={styles.TabPanel}>
          <div className={styles.plot}>
            {checkedDataValues && selectedContextData && (
              <ContextExplorerPlot
                topContextName={topContextNameInfo.display_name}
                selectedContextName={selectedContextNameInfo.display_name}
                data={selectedContextData}
                checkedDataValues={checkedDataValues}
                checkedDatatypes={checkedDatatypes}
                updateDatatypeSelection={updateDatatypeSelection}
                customInfoImg={customInfoImg}
                overlappingDepmapIds={overlappingDepmapIds}
                handleSetPlotElement={handleSetPlotElement}
                plotElement={plotElement}
              />
            )}
          </div>
          <div className={styles.plot}>
            <OverviewTable
              cellLineData={
                overlappingDepmapIds.length > 0
                  ? formattedFilteredData.filter((dataItem: CellLineOverview) =>
                      overlappingDepmapIds.includes(dataItem.depmapId)
                    )
                  : formattedFilteredData
              }
              getCellLineUrlRoot={getCellLineUrlRoot}
            />
          </div>
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          <ContextAnalysis
            selectedContextNameInfo={selectedContextNameInfo}
            topContextNameInfo={topContextNameInfo}
            entityType={"gene"}
            customInfoImg={customInfoImg}
          />
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          {" "}
          <ContextAnalysis
            selectedContextNameInfo={selectedContextNameInfo}
            topContextNameInfo={topContextNameInfo}
            entityType={"compound"}
            customInfoImg={customInfoImg}
          />
        </TabPanel>
      </TabPanels>
    </TabsWithHistory>
  );
};

export default ContextExplorerTabs;
