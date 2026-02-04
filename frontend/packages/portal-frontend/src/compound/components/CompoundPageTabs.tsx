import React, { useState, useEffect } from "react";
import { legacyPortalAPI } from "@depmap/api";
import { CustomList } from "@depmap/cell-line-selector";
import { enabledFeatures, toStaticUrl } from "@depmap/globals";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import AsyncTile from "src/common/components/AsyncTile";
import { EntityType } from "src/entity/models/entities";
import { getQueryParams, sortByNumberOrNull } from "@depmap/utils";
import { Option } from "src/common/models/utilities";
import { ConnectivityValue } from "src/constellation/models/constellation";
import CompoundPageOverview, {
  CompoundTileTypeEnum,
} from "./CompoundPageOverview";
import styles from "../styles/CompoundPage.scss";
import DoseCurvesTab from "../doseCurvesTab/DoseCurvesTab";
import HeatmapTab from "../heatmapTab/HeatmapTab";
import { DatasetOption } from "@depmap/types";

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
  aka: string; // Comma separated string of compound aliases
  compoundUnits: string;
  predictabilityCustomDownloadsLink: string;
  predictabilityMethodologyLink: string;
  hasDatasets: boolean;
  showSensitivityTab: boolean;
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
  sensitivityTabSummary: {
    initialSelectedDataset: DatasetOption;
    size_biom_enum_name: string;
    color: string;
    figure: { name: number };
    show_auc_message: boolean;
    summary_options: DatasetOption[];
  };
}

const CompoundPageTabs = ({
  isMobile,
  order,
  compoundName,
  compoundId,
  aka, // Comma separated string of compound aliases
  compoundUnits,
  predictabilityCustomDownloadsLink,
  predictabilityMethodologyLink,
  hasDatasets,
  showSensitivityTab,
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
  sensitivityTabSummary,
}: Props) => {
  const [
    selectedCellLineList,
    setSelectedCellLineList,
  ] = useState<CustomList>();

  let initialSelectedDataset;
  if (showSensitivityTab && sensitivityTabSummary) {
    const query = getQueryParams();
    let firstSelectedDataset: DatasetOption | undefined =
      sensitivityTabSummary.summary_options[0];
    if ("dependency" in query) {
      firstSelectedDataset = sensitivityTabSummary.summary_options.find(
        (o: any) => o.dataset === query.dependency
      );
    }

    initialSelectedDataset = firstSelectedDataset;
  }

  return (
    <div>
      {isMobile ? (
        <CompoundPageOverview
          compoundName={compoundName}
          aka={aka}
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
            {showSensitivityTab && <Tab id="dependency">Sensitivity</Tab>}
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
                aka={aka}
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
            {showSensitivityTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>Loading...</div>}>
                  {initialSelectedDataset && (
                    <EntitySummary
                      size_biom_enum_name={
                        sensitivityTabSummary.size_biom_enum_name
                      }
                      color={sensitivityTabSummary.color}
                      figure={sensitivityTabSummary.figure}
                      show_auc_message={sensitivityTabSummary.show_auc_message}
                      summary_options={sensitivityTabSummary.summary_options}
                      initialSelectedDataset={initialSelectedDataset}
                      controlledList={selectedCellLineList}
                      onListSelect={setSelectedCellLineList}
                    />
                  )}
                </React.Suspense>
              </TabPanel>
            )}
            {/* Can update this to determine data availability here instead of the portal-backend and tab visibility once the dose response curves are moved to breadbox */}
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
            {/* Can update this to determine data availability here instead of the portal-backend and tab visibility once the dose response curves are moved to breadbox */}
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
            {/* Can update this to determine data availability here instead of the portal-backend and tab visibility once the dose response curves are moved to breadbox */}
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
