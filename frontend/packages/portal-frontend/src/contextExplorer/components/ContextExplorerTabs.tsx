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
  ContextExplorerDatasets,
  ContextNameInfo,
  ContextNode,
  ContextSummary,
  TabTypes,
  TreeType,
} from "../models/types";
import ContextExplorerPlot from "src/contextExplorer/components/ContexExplorerPlot";
import OverviewTable from "src/contextExplorer/components/OverviewTable";
import { capitalizeFirstLetter } from "../utils";
import ContextAnalysis from "src/contextExplorer/components/contextAnalysis/ContextAnalysis";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { enabledFeatures } from "@depmap/globals";

interface Props {
  isLoadingInitialData: boolean;
  selectedContextNameInfo: ContextNameInfo;
  selectedContextNode: ContextNode | null;
  selectedContextData: ContextSummary;
  treeType: TreeType;
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
  isLoadingInitialData,
  selectedContextNameInfo,
  selectedContextNode,
  treeType,
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
  // Filters table data according to the selected context's depmap_ids
  const filteredData = overviewTableData.filter((row) => {
    return selectedContextData.all_depmap_ids.some(
      (a) => a[1] === row.model_id
    );
  });

  const formattedFilteredData: CellLineOverview[] = filteredData.map((row) => {
    return {
      depmapId: row.model_id,
      cellLineDisplayName: row.cell_line_display_name,
      lineage: row.lineage,
      primaryDisease: row.primary_disease,
      level0: row.level_0,
      level1: row.level_1,
      level2: row.level_2,
      level3: row.level_3,
      level4: row.level_4,
      level5: row.level_5,
      crispr: capitalizeFirstLetter(String(row.crispr)),
      rnai: capitalizeFirstLetter(String(row.rnai)),
      wgs: capitalizeFirstLetter(String(row.wgs)),
      wes: capitalizeFirstLetter(String(row.wes)),
      rna_seq: capitalizeFirstLetter(String(row.rna_seq)),
      prismOncRef: capitalizeFirstLetter(String(row.oncref)),
      prismRepurposing: capitalizeFirstLetter(String(row.repurposing)),
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
          CRISPR Gene Dependency
        </Tab>
        {enabledFeatures.context_explorer_prerelease_datasets && (
          <Tab id="oncref" className={styles.Tab}>
            OncRef Sensitivity
          </Tab>
        )}
        <Tab id="repurposing" className={styles.Tab}>
          Repurposing Sensitivity
        </Tab>
      </TabList>

      <TabPanels className={styles.TabPanels}>
        <TabPanel className={styles.TabPanel}>
          <div className={styles.plot}>
            {checkedDataValues &&
              selectedContextData &&
              !isLoadingInitialData && (
                <ContextExplorerPlot
                  topContextName={topContextNameInfo.name}
                  selectedContextNameInfo={selectedContextNameInfo}
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
          {checkedDataValues &&
            selectedContextData &&
            !isLoadingInitialData && (
              <OverviewTable
                cellLineData={
                  overlappingDepmapIds.length > 0
                    ? formattedFilteredData.filter(
                        (dataItem: CellLineOverview) =>
                          overlappingDepmapIds.includes(dataItem.depmapId)
                      )
                    : formattedFilteredData
                }
                getCellLineUrlRoot={getCellLineUrlRoot}
              />
            )}
        </TabPanel>
        <TabPanel className={styles.TabPanel}>
          {!isLoadingInitialData && (
            <ContextAnalysis
              selectedContextNode={selectedContextNode}
              selectedContextNameInfo={selectedContextNameInfo}
              topContextNameInfo={topContextNameInfo}
              treeType={treeType}
              entityType={"gene"}
              datasetId={ContextExplorerDatasets.Chronos_Combined}
            />
          )}
        </TabPanel>
        {enabledFeatures.context_explorer_prerelease_datasets && (
          <TabPanel className={styles.TabPanel}>
            {" "}
            {!isLoadingInitialData && (
              <ContextAnalysis
                selectedContextNode={selectedContextNode}
                selectedContextNameInfo={selectedContextNameInfo}
                topContextNameInfo={topContextNameInfo}
                treeType={treeType}
                entityType={"compound"}
                datasetId={ContextExplorerDatasets.Prism_oncology_AUC}
              />
            )}
          </TabPanel>
        )}
        <TabPanel className={styles.TabPanel}>
          {" "}
          {!isLoadingInitialData && (
            <ContextAnalysis
              selectedContextNode={selectedContextNode}
              selectedContextNameInfo={selectedContextNameInfo}
              topContextNameInfo={topContextNameInfo}
              treeType={treeType}
              entityType={"compound"}
              datasetId={ContextExplorerDatasets.Rep_all_single_pt}
            />
          )}
        </TabPanel>
      </TabPanels>
    </TabsWithHistory>
  );
};

export default ContextExplorerTabs;
