import React, { useState } from "react";
import { CustomList } from "@depmap/cell-line-selector";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import { EntityType } from "src/entity/models/entities";
import { sortByNumberOrNull } from "@depmap/utils";
import CompoundPageOverview from "./CompoundPageOverview";
import styles from "../styles/CompoundPage.scss";
import DoseCurvesTab from "../doseCurvesTab/DoseCurvesTab";
import HeatmapTab from "../heatmapTab/HeatmapTab";
import { DatasetOption, SensitivityTabSummary } from "@depmap/types";

// Many of the compound page tiles make calls to a global `clickTab` function. Here
// we're defining it to dispatch a custom "clickTab" event that is caught by
// the TabsWithHistory component.
window.clickTab = (tabId: string) => {
  window.dispatchEvent(
    new CustomEvent("clickTab", {
      bubbles: true,
      detail: { tabId, queryParamName: "tab" },
    })
  );
};

// For #dependency (titled "Perturbation Effects")
const EntitySummary = React.lazy(
  () =>
    import(
      /* webpackChunkName: "EntitySummary" */
      "src/entity/components/EntitySummary"
    )
);

const PredictabilityTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PredictabilityTab" */
      "src/predictability/components/PredictabilityTab"
    )
);

const CorrelationAnalysis = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CorrelationAnalysis" */
      "src/correlationAnalysis/components/index"
    )
);

interface Props {
  isMobile: boolean;
  order: any;
  compoundName: string;
  compoundId: string;
  compoundUnits: string;
  predictabilityCustomDownloadsLink: string;
  predictabilityMethodologyLink: string;
  hasDatasets: boolean;
  showPredictabilityTab: boolean;
  showDoseCurvesTab: boolean;
  showHeatmapTab: boolean;
  showCorrelationAnalysisTab: boolean;
  showEnrichedLineages: boolean;
  showCorrelatedDependenciesTile: boolean;
  showRelatedCompoundTiles: boolean;
  doseCurveTabOptions: any[];
  heatmapTabOptions: any[];
  correlationAnalysisOptions: any[];
  sensitivitySummary: SensitivityTabSummary | null;
  initialSelectedDataset: DatasetOption | undefined;
}

const CompoundPageTabs = ({
  isMobile,
  order,
  compoundName,
  compoundId,
  compoundUnits,
  predictabilityCustomDownloadsLink,
  predictabilityMethodologyLink,
  hasDatasets,
  showPredictabilityTab,
  showDoseCurvesTab,
  showHeatmapTab,
  showCorrelationAnalysisTab,
  showEnrichedLineages,
  showCorrelatedDependenciesTile,
  showRelatedCompoundTiles,
  doseCurveTabOptions,
  heatmapTabOptions,
  correlationAnalysisOptions,
  sensitivitySummary,
  initialSelectedDataset,
}: Props) => {
  const [
    selectedCellLineList,
    setSelectedCellLineList,
  ] = useState<CustomList>();

  return (
    <div>
      {isMobile ? (
        <CompoundPageOverview
          compoundName={compoundName}
          showPredictability={showPredictabilityTab}
          showHeatmap={showHeatmapTab}
          showEnrichedLineages={showEnrichedLineages}
          showCorrelatedDependenciesTile={showCorrelatedDependenciesTile}
          showRelatedCompoundsTile={showRelatedCompoundTiles}
          orderedTiles={order}
          hasDatasets={hasDatasets}
          isMobile={isMobile}
        />
      ) : (
        <TabsWithHistory
          className={styles.Tabs}
          isManual
          isLazy
          lazyBehavior="keepMounted"
        >
          <TabList className={styles.TabList}>
            <Tab id="overview">Overview</Tab>
            {sensitivitySummary && <Tab id="dependency">Sensitivity</Tab>}
            {showDoseCurvesTab && <Tab id="dose-curves-new">Dose Curves</Tab>}
            {showHeatmapTab && <Tab id="heatmap">Heatmap</Tab>}
            {showPredictabilityTab && (
              <Tab id="predictability">Predictability</Tab>
            )}
            {showCorrelationAnalysisTab && (
              <Tab id="correlation_analysis">Correlation Analysis</Tab>
            )}
          </TabList>

          <TabPanels className={styles.TabPanels}>
            <TabPanel className={styles.TabPanel}>
              <CompoundPageOverview
                compoundName={compoundName}
                showPredictability={showPredictabilityTab}
                showHeatmap={showHeatmapTab}
                showEnrichedLineages={showEnrichedLineages}
                showCorrelatedDependenciesTile={showCorrelatedDependenciesTile}
                showRelatedCompoundsTile={showRelatedCompoundTiles}
                orderedTiles={order}
                hasDatasets={hasDatasets}
                isMobile={isMobile}
              />
            </TabPanel>
            {sensitivitySummary && initialSelectedDataset && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>Loading...</div>}>
                  {/* Using data from the hook here */}
                  {initialSelectedDataset && (
                    <EntitySummary
                      size_biom_enum_name={
                        sensitivitySummary.size_biom_enum_name
                      }
                      color={sensitivitySummary.color}
                      figure={sensitivitySummary.figure}
                      show_auc_message={sensitivitySummary.show_auc_message}
                      summary_options={sensitivitySummary.summary_options}
                      initialSelectedDataset={initialSelectedDataset}
                      controlledList={selectedCellLineList}
                      onListSelect={setSelectedCellLineList}
                    />
                  )}
                </React.Suspense>
              </TabPanel>
            )}
            {showDoseCurvesTab && (
              <TabPanel className={styles.TabPanel}>
                <DoseCurvesTab
                  datasetOptions={sortByNumberOrNull(
                    doseCurveTabOptions,
                    "auc_dataset_priority",
                    "asc"
                  )}
                  doseUnits={compoundUnits}
                  compoundName={compoundName}
                  compoundId={compoundId}
                />
              </TabPanel>
            )}
            {showHeatmapTab && (
              <TabPanel className={styles.TabPanel}>
                <HeatmapTab
                  datasetOptions={sortByNumberOrNull(
                    heatmapTabOptions,
                    "auc_dataset_priority",
                    "asc"
                  )}
                  doseUnits={compoundUnits}
                  compoundName={compoundName}
                  compoundId={compoundId}
                />
              </TabPanel>
            )}
            {showPredictabilityTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>loading...</div>}>
                  <div id="predictive-tab-root">
                    <PredictabilityTab
                      entityIdOrLabel={compoundName} // weird that it takes compoundName twice, but this consistent with the old implementation
                      entityLabel={compoundName}
                      entityType={"compound" as EntityType}
                      customDownloadsLink={predictabilityCustomDownloadsLink}
                      methodologyUrl={predictabilityMethodologyLink}
                    />
                  </div>
                </React.Suspense>
              </TabPanel>
            )}
            {showCorrelationAnalysisTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <CorrelationAnalysis
                    compoundDatasetOptions={sortByNumberOrNull(
                      correlationAnalysisOptions,
                      "auc_dataset_priority",
                      "asc"
                    )}
                    geneDatasetOptions={[]}
                    featureName={compoundId}
                    featureId={compoundId}
                    featureType={"compound"}
                  />
                </React.Suspense>
              </TabPanel>
            )}
          </TabPanels>
        </TabsWithHistory>
      )}
    </div>
  );
};

export default CompoundPageTabs;
