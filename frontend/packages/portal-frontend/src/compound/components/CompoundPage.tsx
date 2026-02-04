import React from "react";
import styles from "../styles/CompoundPage.scss";
import CompoundPageTabs from "./CompoundPageTabs";
import CompoundPageHeader from "./CompoundPageHeader";
import { useCompoundPageData } from "../hooks/useCompoundPageData";
import { enabledFeatures } from "@depmap/globals";

interface Props {
  isMobile: boolean;
  order: any;
  compoundName: string;
  compoundId: string;
  aka: string; // Comma separated list of compound aliases
  compoundUnits: string;
  predictabilityCustomDownloadsLink: string;
  predictabilityMethodologyLink: string;
  hasDatasets: boolean;
  showPredictabilityTab: boolean;
}

const CompoundPage = ({
  isMobile,
  order,
  compoundName,
  compoundId,
  aka, // Comma separated string of compound aliases
  compoundUnits,
  predictabilityCustomDownloadsLink,
  predictabilityMethodologyLink,
  hasDatasets,
  showPredictabilityTab,
}: Props) => {
  const {
    isLoading,
    sensitivitySummary,
    initialSelectedDataset,
    doseCurveOptions,
    heatmapOptions,
    correlationAnalysisOptions,
    showEnrichedLineages,
  } = useCompoundPageData(compoundId, compoundName);

  return (
    <div className={styles.CompoundPage}>
      <CompoundPageHeader compoundName={compoundName} aka={aka} />
      {!isLoading && (
        <CompoundPageTabs
          isMobile={isMobile}
          order={order}
          compoundName={compoundName}
          compoundId={compoundId}
          compoundUnits={compoundUnits}
          predictabilityCustomDownloadsLink={predictabilityCustomDownloadsLink}
          predictabilityMethodologyLink={predictabilityMethodologyLink}
          hasDatasets={hasDatasets}
          showPredictabilityTab={showPredictabilityTab}
          showDoseCurvesTab={
            doseCurveOptions.length > 0 && enabledFeatures.new_dose_curves_tab
          }
          showHeatmapTab={
            heatmapOptions.length > 0 && enabledFeatures.heatmap_tab
          }
          showCorrelationAnalysisTab={correlationAnalysisOptions.length > 0}
          showEnrichedLineages={showEnrichedLineages}
          showCorrelatedDependenciesTile={
            enabledFeatures.compound_correlated_dependencies_tile
          }
          showRelatedCompoundTiles={enabledFeatures.related_compounds_tile}
          doseCurveTabOptions={doseCurveOptions}
          heatmapTabOptions={heatmapOptions}
          correlationAnalysisOptions={correlationAnalysisOptions}
          sensitivitySummary={sensitivitySummary}
          initialSelectedDataset={initialSelectedDataset}
        />
      )}
    </div>
  );
};

export default CompoundPage;
