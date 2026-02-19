import React from "react";
import styles from "../styles/CompoundPage.scss";
import CompoundPageTabs from "./CompoundPageTabs";
import CompoundPageHeader from "./CompoundPageHeader";
import { useCompoundPageSelectionOptions } from "../hooks/useCompoundPageSelectionOptions";
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
  showEnrichedLineages: boolean;
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
  showEnrichedLineages,
}: Props) => {
  const {
    isLoadingSelectionOptions,
    sensitivitySummary,
    initialSelectedDataset,
    doseCurveOptions,
    heatmapOptions,
    correlationAnalysisOptions,
  } = useCompoundPageSelectionOptions(compoundId, compoundName);

  return (
    <div className={styles.CompoundPage}>
      <CompoundPageHeader compoundName={compoundName} aka={aka} />
      <CompoundPageTabs
        isLoadingSelectionOptions={isLoadingSelectionOptions}
        isMobile={isMobile}
        order={order}
        compoundName={compoundName}
        compoundId={compoundId}
        compoundUnits={compoundUnits}
        predictabilityCustomDownloadsLink={predictabilityCustomDownloadsLink}
        predictabilityMethodologyLink={predictabilityMethodologyLink}
        hasDatasets={hasDatasets}
        showPredictabilityTab={showPredictabilityTab}
        showDoseCurvesTab={enabledFeatures.new_dose_curves_tab}
        showHeatmapTab={enabledFeatures.heatmap_tab}
        showCorrelationAnalysisTab={enabledFeatures.correlation_analysis}
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
    </div>
  );
};

export default CompoundPage;
