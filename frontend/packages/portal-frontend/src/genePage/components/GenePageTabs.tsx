import React, { useState, useEffect } from "react";
import { CustomList } from "@depmap/cell-line-selector";
import { enabledFeatures } from "@depmap/globals";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import AsyncTile from "src/common/components/AsyncTile";
import { EntityType } from "src/entity/models/entities";
import { getQueryParams } from "@depmap/utils";
import { DatasetOption } from "src/entity/components/EntitySummary";
import GenePageOverview, { TileTypeEnum } from "./GenePageOverview";
import GeneCharacterizationPanel from "./GeneCharacterizationPanel";
import styles from "../styles/GenePage.scss";
import { getCorrelationDatasetsForEntity } from "../utils";
import { GeneCorrelationDatasetOption } from "src/correlationAnalysis/types";

// Many of the gene page tiles make calls to a global `clickTab` function. Here
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
  symbol: string;
  showDependencyTab: boolean;
  showConfidenceTab: boolean;
  showCharacterizationTab: boolean;
  showPredictabilityTab: boolean;
  hasDatasets: boolean;
  order: [TileTypeEnum, number][][];
  isMobile: boolean;
  entityId: string;
  entrezId: string;
  customDownloadsLink: string;
  methodologyLink: string;
  sizeBiomEnumName: string;
  color: string;
  figure: { name: number };
  showAUCMessage: boolean;
  summaryOptions: Array<DatasetOption>;
  showMutationsTile: boolean;
  showOmicsExpressionTile: boolean;
  showTargetingCompoundsTile: boolean;
}

const GenePageTabs = ({
  symbol,
  showDependencyTab,
  showConfidenceTab,
  showCharacterizationTab,
  showPredictabilityTab,
  hasDatasets,
  order,
  isMobile,
  entityId: legacyEntityId,
  entrezId,
  customDownloadsLink,
  methodologyLink,
  sizeBiomEnumName,
  color,
  figure,
  showAUCMessage,
  summaryOptions,
  showMutationsTile,
  showOmicsExpressionTile,
  showTargetingCompoundsTile,
}: Props) => {
  const [
    selectedCellLineList,
    setSelectedCellLineList,
  ] = useState<CustomList>();

  let initialSelectedDataset;
  if (showDependencyTab && summaryOptions) {
    const query = getQueryParams();
    let firstSelectedDataset: DatasetOption | undefined = summaryOptions[0];
    if ("dependency" in query) {
      firstSelectedDataset = summaryOptions.find(
        (o: any) => o.dataset === query.dependency
      );
    }

    initialSelectedDataset = firstSelectedDataset;
  }

  const [
    geneCorrelationAnalysisOptions,
    setGeneCorrelationAnalysisOptions,
  ] = useState<GeneCorrelationDatasetOption[]>([]);
  const [isLoadingGeneOptions, setIsLoadingGeneOptions] = useState<boolean>(
    true
  );

  useEffect(() => {
    let isCurrent = true;

    const fetchOptions = async () => {
      try {
        const options = await getCorrelationDatasetsForEntity(entrezId);

        if (isCurrent) {
          setGeneCorrelationAnalysisOptions(options);
          setIsLoadingGeneOptions(false);
        }
      } catch (e) {
        console.error("Failed to fetch correlation analysis options", e);
        setIsLoadingGeneOptions(false);
      }
    };

    fetchOptions();

    return () => {
      isCurrent = false;
    };
  }, [entrezId]);

  return (
    <div>
      {isMobile ? (
        <GenePageOverview
          symbol={symbol}
          showDependencyTab={showDependencyTab}
          showConfidenceTab={showConfidenceTab}
          showCharacterizationTab={showCharacterizationTab}
          showPredictabilityTab={showPredictabilityTab}
          orderedTiles={order}
          hasDatasets={hasDatasets}
          isMobile={isMobile}
          showMutationsTile={showMutationsTile}
          showOmicsExpressionTile={showOmicsExpressionTile}
          showTargetingCompoundsTile={showTargetingCompoundsTile}
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
            {showDependencyTab && (
              <Tab id="dependency">Perturbation Effects</Tab>
            )}
            {showConfidenceTab && (
              <Tab id="confidence">Perturbation Confidence</Tab>
            )}
            {showCharacterizationTab && (
              <Tab id="characterization">Characterization</Tab>
            )}
            {showPredictabilityTab && (
              <Tab id="predictability">Predictability</Tab>
            )}
            {enabledFeatures.gene_page_correlation_analysis && (
              <Tab id="correlation_analysis">Correlation Analysis</Tab>
            )}
          </TabList>

          <TabPanels className={styles.TabPanels}>
            <TabPanel className={styles.TabPanel}>
              <GenePageOverview
                symbol={symbol}
                showDependencyTab={showDependencyTab}
                showConfidenceTab={showConfidenceTab}
                showCharacterizationTab={showCharacterizationTab}
                showPredictabilityTab={showPredictabilityTab}
                orderedTiles={order}
                hasDatasets={hasDatasets}
                isMobile={isMobile}
                showMutationsTile={showMutationsTile}
                showOmicsExpressionTile={showOmicsExpressionTile}
                showTargetingCompoundsTile={showTargetingCompoundsTile}
              />
            </TabPanel>
            {showDependencyTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>Loading...</div>}>
                  {initialSelectedDataset && (
                    <EntitySummary
                      size_biom_enum_name={sizeBiomEnumName}
                      color={color}
                      figure={figure}
                      show_auc_message={showAUCMessage}
                      summary_options={summaryOptions}
                      initialSelectedDataset={initialSelectedDataset}
                      controlledList={selectedCellLineList}
                      onListSelect={setSelectedCellLineList}
                    />
                  )}
                </React.Suspense>
              </TabPanel>
            )}
            {showConfidenceTab && (
              <TabPanel className={styles.TabPanel}>
                <AsyncTile url={`/gene/gene_confidence/${symbol}`} />
              </TabPanel>
            )}
            {showCharacterizationTab && (
              <TabPanel className={styles.TabPanel}>
                <GeneCharacterizationPanel
                  symbol={symbol}
                  entityId={legacyEntityId}
                  selectedCellLineList={selectedCellLineList}
                  onListSelect={setSelectedCellLineList}
                />
              </TabPanel>
            )}
            {showPredictabilityTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>loading...</div>}>
                  <div id="predictive-tab-root">
                    <PredictabilityTab
                      entityIdOrLabel={legacyEntityId}
                      entityLabel={symbol}
                      entityType={EntityType.Gene}
                      customDownloadsLink={customDownloadsLink}
                      methodologyUrl={methodologyLink}
                    />
                  </div>
                </React.Suspense>
              </TabPanel>
            )}
            {enabledFeatures.gene_page_correlation_analysis &&
              !isLoadingGeneOptions && (
                <TabPanel className={styles.TabPanel}>
                  <React.Suspense fallback={<div>Loading...</div>}>
                    <CorrelationAnalysis
                      compoundDatasetOptions={[]}
                      geneDatasetOptions={geneCorrelationAnalysisOptions}
                      featureName={symbol}
                      featureId={entrezId}
                      featureType={"gene"}
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

export default GenePageTabs;
