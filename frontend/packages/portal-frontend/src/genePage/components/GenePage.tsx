import React from "react";
import { Option } from "src/common/models/utilities";
import { ConnectivityValue } from "src/constellation/models/constellation";
import { DatasetOption } from "src/entity/components/EntitySummary";
import GenePageHeader from "./GenePageHeader";
import GenePageTabs from "./GenePageTabs";
import styles from "../styles/GenePage.scss";
import { TileTypeEnum } from "./GenePageOverview";

interface Props {
  fullName: string;
  symbol: string;
  ensemblId: string;
  entrezId: string;
  hgncId: string;
  aka: string;
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
}

const GenePage = ({
  fullName,
  symbol,
  ensemblId,
  entrezId,
  hgncId,
  aka,
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
}: Props) => {
  return (
    <div className={styles.GenePage}>
      <GenePageHeader
        fullName={fullName}
        symbol={symbol}
        ensemblId={ensemblId}
        entrezId={entrezId}
        hgncId={hgncId}
        aka={aka}
      />
      <GenePageTabs
        symbol={symbol}
        showDependencyTab={showDependencyTab}
        showConfidenceTab={showConfidenceTab}
        showCharacterizationTab={showCharacterizationTab}
        showPredictabilityTab={showPredictabilityTab}
        showCelfieTab={showCelfieTab}
        showCelfieTile={showCelfieTile}
        hasDatasets={hasDatasets}
        order={order}
        isMobile={isMobile}
        entityId={entityId}
        customDownloadsLink={customDownloadsLink}
        methodologyLink={methodologyLink}
        similarityOptions={similarityOptions}
        colorOptions={colorOptions}
        connectivityOptions={connectivityOptions}
        targetFeatureLabel={targetFeatureLabel}
        datasets={datasets}
        dependencyProfileOptions={dependencyProfileOptions}
        howToImg={howToImg}
        sizeBiomEnumName={sizeBiomEnumName}
        color={color}
        figure={figure}
        showAUCMessage={showAUCMessage}
        summaryOptions={summaryOptions}
        showMutationsTile={showMutationsTile}
        showOmicsExpressionTile={showOmicsExpressionTile}
        showTargetingCompoundsTile={showTargetingCompoundsTile}
      />
    </div>
  );
};

export default GenePage;
