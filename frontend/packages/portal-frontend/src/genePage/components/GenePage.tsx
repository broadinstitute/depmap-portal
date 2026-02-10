import React from "react";
import GenePageHeader from "./GenePageHeader";
import GenePageTabs from "./GenePageTabs";
import styles from "../styles/GenePage.scss";
import { TileTypeEnum } from "./GenePageOverview";
import { DatasetOption } from "@depmap/types";

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
  hasDatasets: boolean;
  order: [TileTypeEnum, number][][];
  isMobile: boolean;
  entityId: string;
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
  showEnrichmentTile: boolean;
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
  hasDatasets,
  order,
  isMobile,
  entityId,
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
  showEnrichmentTile,
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
        hasDatasets={hasDatasets}
        order={order}
        isMobile={isMobile}
        entityId={entityId}
        entrezId={entrezId}
        customDownloadsLink={customDownloadsLink}
        methodologyLink={methodologyLink}
        sizeBiomEnumName={sizeBiomEnumName}
        color={color}
        figure={figure}
        showAUCMessage={showAUCMessage}
        summaryOptions={summaryOptions}
        showMutationsTile={showMutationsTile}
        showOmicsExpressionTile={showOmicsExpressionTile}
        showTargetingCompoundsTile={showTargetingCompoundsTile}
        showEnrichmentTile={showEnrichmentTile}
      />
    </div>
  );
};

export default GenePage;
