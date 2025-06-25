import React, { useState } from "react";
import { legacyPortalAPI } from "@depmap/api";
import { CustomList } from "@depmap/cell-line-selector";
import { toStaticUrl } from "@depmap/globals";
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
import { Option } from "src/common/models/utilities";
import { ConnectivityValue } from "src/constellation/models/constellation";
import { DatasetOption } from "src/entity/components/EntitySummary";
import GenePageOverview, { TileTypeEnum } from "./GenePageOverview";
import GeneCharacterizationPanel from "./GeneCharacterizationPanel";
import styles from "../styles/GenePage.scss";

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

// For tab titled "Genomic Associations"
const CelfiePage = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CelfiePage" */
      "src/celfie/components/CelfiePage"
    )
);

const PredictabilityTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PredictabilityTab" */
      "src/predictability/components/PredictabilityTab"
    )
);

const PredictabilityPrototypeTab = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PredictabilityPrototypeTab" */
      "src/predictabilityPrototype/components/PredictabilityPrototypeTab"
    )
);

interface Props {
  symbol: string;
  showDependencyTab: boolean;
  showConfidenceTab: boolean;
  showCharacterizationTab: boolean;
  showPredictabilityTab: boolean;
  showCelfieTab: boolean;
  showCelfieTile: boolean;
  hasDatasets: boolean;
  order: [TileTypeEnum, number][][];
  isMobile: boolean;
  entityId: string;
  customDownloadsLink: string;
  methodologyLink: string;
  similarityOptions: Array<Option<string>>;
  colorOptions: Array<Option<string>>;
  connectivityOptions: Array<Option<ConnectivityValue>>;
  targetFeatureLabel: string;
  datasets: Array<Option<string>>;
  dependencyProfileOptions: Array<DatasetOption>;
  howToImg: string;
  sizeBiomEnumName: string;
  color: string;
  figure: { name: number };
  showAUCMessage: boolean;
  summaryOptions: Array<DatasetOption>;
  showMutationsTile: boolean;
  showOmicsExpressionTile: boolean;
  showTargetingCompoundsTile: boolean;
  showPredictabilityPrototype: boolean;
}

const GenePageTabs = ({
  symbol,
  showDependencyTab,
  showConfidenceTab,
  showCharacterizationTab,
  showPredictabilityTab,
  showCelfieTab,
  showCelfieTile,
  hasDatasets,
  order,
  isMobile,
  entityId,
  customDownloadsLink,
  methodologyLink,
  similarityOptions,
  colorOptions,
  connectivityOptions,
  targetFeatureLabel,
  datasets,
  dependencyProfileOptions,
  howToImg,
  sizeBiomEnumName,
  color,
  figure,
  showAUCMessage,
  summaryOptions,
  showMutationsTile,
  showOmicsExpressionTile,
  showTargetingCompoundsTile,
  showPredictabilityPrototype,
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

  return (
    <div>
      {isMobile ? (
        <GenePageOverview
          symbol={symbol}
          showDependencyTab={showDependencyTab}
          showConfidenceTab={showConfidenceTab}
          showCharacterizationTab={showCharacterizationTab}
          showCelfieTile={showCelfieTile}
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
            {showCelfieTab && (
              <Tab id="genomic_assoc">Genomic Associations</Tab>
            )}
            {showPredictabilityTab && (
              <Tab id="predictability">Predictability</Tab>
            )}
            {showPredictabilityPrototype && (
              <Tab id="predictability_prototype">Predictive Insights</Tab>
            )}
          </TabList>

          <TabPanels className={styles.TabPanels}>
            <TabPanel className={styles.TabPanel}>
              <GenePageOverview
                symbol={symbol}
                showDependencyTab={showDependencyTab}
                showConfidenceTab={showConfidenceTab}
                showCharacterizationTab={showCharacterizationTab}
                showCelfieTile={showCelfieTile}
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
                  entityId={entityId}
                  selectedCellLineList={selectedCellLineList}
                  onListSelect={setSelectedCellLineList}
                />
              </TabPanel>
            )}
            {showCelfieTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <CelfiePage
                    getGraphData={(
                      taskIds,
                      numGenes,
                      similarityMeasure,
                      connectivity,
                      topFeature
                    ) =>
                      legacyPortalAPI.getConstellationGraphs(
                        taskIds,
                        null,
                        similarityMeasure,
                        numGenes,
                        connectivity,
                        topFeature
                      )
                    }
                    getVolcanoData={legacyPortalAPI.getTaskStatus}
                    similarityOptions={similarityOptions}
                    colorOptions={colorOptions}
                    connectivityOptions={connectivityOptions}
                    targetFeatureLabel={targetFeatureLabel}
                    datasets={datasets}
                    getComputeUnivariateAssociations={
                      legacyPortalAPI.computeUnivariateAssociations
                    }
                    dependencyProfileOptions={dependencyProfileOptions}
                    onCelfieInitialized={() => {}}
                    howToImg={howToImg}
                    methodIcon={toStaticUrl("img/predictability/pdf.svg")}
                    methodPdf={toStaticUrl(
                      "pdf/Genomic_Associations_Methodology.pdf"
                    )}
                  />
                </React.Suspense>
              </TabPanel>
            )}
            {showPredictabilityTab && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>loading...</div>}>
                  <div id="predictive-tab-root">
                    <PredictabilityTab
                      entityIdOrLabel={entityId}
                      entityLabel={symbol}
                      entityType={EntityType.Gene}
                      customDownloadsLink={customDownloadsLink}
                      methodologyUrl={methodologyLink}
                    />
                  </div>
                </React.Suspense>
              </TabPanel>
            )}
            {showPredictabilityPrototype && (
              <TabPanel className={styles.TabPanel}>
                <React.Suspense fallback={<div>loading...</div>}>
                  <PredictabilityPrototypeTab
                    entityIdOrLabel={entityId}
                    entityLabel={symbol}
                    entityType={EntityType.Gene}
                    customDownloadsLink={customDownloadsLink}
                    methodologyUrl={methodologyLink}
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
