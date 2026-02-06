import React, { useMemo, useState } from "react";
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
  isLoadingSelectionOptions: boolean;
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
  isLoadingSelectionOptions,
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

  const sortedOptions = useMemo(() => {
    return {
      doseCurves:
        doseCurveTabOptions.length > 0
          ? sortByNumberOrNull(
              doseCurveTabOptions,
              "auc_dataset_priority",
              "asc"
            )
          : [],
      heatmap:
        heatmapTabOptions.length > 0
          ? sortByNumberOrNull(heatmapTabOptions, "auc_dataset_priority", "asc")
          : [],
      correlation:
        correlationAnalysisOptions.length > 0
          ? sortByNumberOrNull(
              correlationAnalysisOptions,
              "auc_dataset_priority",
              "asc"
            )
          : [],
    };
  }, [doseCurveTabOptions, heatmapTabOptions, correlationAnalysisOptions]);

  // 2. Define a helper to handle the "Empty vs Loading vs Content" state
  const renderTabContent = (
    hasData: boolean,
    isEmptyMessage: string,
    children: React.ReactNode
  ) => {
    if (isLoadingSelectionOptions) {
      return <div className={styles.TabLoadingPlaceholder}>Loading...</div>;
    }
    if (!hasData) {
      return <div className={styles.TabEmptyState}>{isEmptyMessage}</div>;
    }
    return children;
  };

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
            <Tab id="dependency">Sensitivity</Tab>
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
            <TabPanel className={styles.TabPanel}>
              {renderTabContent(
                !!(sensitivitySummary && initialSelectedDataset),
                `No sensitivity data found for ${compoundName}`,
                <React.Suspense fallback={<div>Downloading component...</div>}>
                  {sensitivitySummary && initialSelectedDataset && (
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
              )}
            </TabPanel>

            {showDoseCurvesTab && (
              <TabPanel className={styles.TabPanel}>
                {renderTabContent(
                  sortedOptions.doseCurves.length > 0,
                  `No dose curves data found for ${compoundName}`,
                  <DoseCurvesTab
                    datasetOptions={sortedOptions.doseCurves}
                    doseUnits={compoundUnits}
                    compoundName={compoundName}
                    compoundId={compoundId}
                  />
                )}
              </TabPanel>
            )}
            {showHeatmapTab && (
              <TabPanel className={styles.TabPanel}>
                {renderTabContent(
                  sortedOptions.heatmap.length > 0,
                  `No heatmap data found for ${compoundName}`,
                  <HeatmapTab
                    datasetOptions={sortedOptions.heatmap}
                    doseUnits={compoundUnits}
                    compoundName={compoundName}
                    compoundId={compoundId}
                  />
                )}
              </TabPanel>
            )}
            {showPredictabilityTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>Loading predictability...</div>}>
                  <PredictabilityTab
                    entityIdOrLabel={compoundName}
                    entityLabel={compoundName}
                    entityType={"compound" as EntityType}
                    customDownloadsLink={predictabilityCustomDownloadsLink}
                    methodologyUrl={predictabilityMethodologyLink}
                  />
                </React.Suspense>
              </TabPanel>
            )}
            {showCorrelationAnalysisTab && (
              <TabPanel className={styles.TabPanel}>
                {renderTabContent(
                  sortedOptions.correlation.length > 0,
                  `No correlation data found for ${compoundName}`,
                  <React.Suspense fallback={<div>Loading analysis...</div>}>
                    <CorrelationAnalysis
                      compoundDatasetOptions={sortedOptions.correlation}
                      geneDatasetOptions={[]}
                      featureName={compoundId}
                      featureId={compoundId}
                      featureType={"compound"}
                    />
                  </React.Suspense>
                )}
              </TabPanel>
            )}
          </TabPanels>
        </TabsWithHistory>
      )}
    </div>
  );
};

export default CompoundPageTabs;
