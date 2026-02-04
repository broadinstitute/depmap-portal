import React from "react";
import styles from "../styles/CompoundPage.scss";
import CompoundPageTabs from "./CompoundPageTabs";
import CompoundPageHeader from "./CompoundPageHeader";
import { DatasetOption } from "@depmap/types";

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
  return (
    <div className={styles.CompoundPage}>
      <CompoundPageHeader compoundName={compoundName} aka={aka} />
      <CompoundPageTabs
        isMobile={isMobile}
        order={order}
        compoundName={compoundName}
        compoundId={compoundId}
        aka={aka}
        compoundUnits={compoundUnits}
        predictabilityCustomDownloadsLink={predictabilityCustomDownloadsLink}
        predictabilityMethodologyLink={predictabilityMethodologyLink}
        hasDatasets={hasDatasets}
        showSensitivityTab={showSensitivityTab}
        showPredictabilityTab={showPredictabilityTab}
        showDoseCurvesTab={showDoseCurvesTab}
        showHeatmapTab={showHeatmapTab}
        showCorrelationAnalysisTab={showCorrelationAnalysisTab}
        showEnrichedLineages={showEnrichedLineages}
        showCorrelatedDependenciesTile={showCorrelatedDependenciesTile}
        showRelatedCompoundTiles={showRelatedCompoundTiles}
        doseCurveTabOptions={doseCurveTabOptions}
        heatmapTabOptions={heatmapTabOptions}
        correlationAnalysisOptions={correlationAnalysisOptions}
        sensitivityTabSummary={sensitivityTabSummary}
      />
    </div>
  );
};

export default CompoundPage;
