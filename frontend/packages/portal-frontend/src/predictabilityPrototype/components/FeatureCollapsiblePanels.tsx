import React from "react";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import StyledMeter from "src/common/components/StyledMeter";
import { getDapi } from "src/common/utilities/context";
import PredictabilityWaterfallPlot from "./PredictabilityWaterfallPlot";
import RelatedFeaturesCorrPlot from "./RelatedFeaturesCorrPlot";
import PredictabilityBoxPlot from "./PredictabilityBoxPlot";
import FeatureVsGeneEffectPlot from "./FeatureVsGeneEffectPlot";

interface FeatureSinglePanelHeaderProps {
  feature: string;
  relativeImportance: number;
  correlation: number;
  featureType: string;
  isOpen: boolean;
}

export const FeatureCollapsiblePanelHeader = ({
  feature,
  relativeImportance,
  correlation,
  featureType,
  isOpen,
}: FeatureSinglePanelHeaderProps) => {
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.one}>{
              <span
              style={{paddingRight: "8px", paddingTop: "3px", fontSize: "12px"}}
                className={isOpen ? "glyphicon glyphicon-chevron-up"
                : "glyphicon glyphicon-chevron-down"}
              />
            }{feature}</span>
      <div className={styles.two}>
        {" "}
        {relativeImportance && (
          <StyledMeter
            value={relativeImportance}
            style={{ barColor: "#97C2D4", maxWidth: "120px", labelFontSize: "14px", labelLeftPosition: "70px"}}
            extraClassNames={"styled-correlation-box"}
            toFixed={2}
            percentage
            showLabel
          />
        )}
      </div>
      <span className={styles.three}>
        {" "}
        {correlation && (
          <StyledMeter
            value={correlation}
            style={{ barColor: "#E79E9D", maxWidth: "120px", labelFontSize: "14px", labelLeftPosition: "70px" }}
            extraClassNames={"styled-correlation-box"}
            toFixed={3}
            showLabel
          />
        )}
      </span>
      <span className={styles.four}>{featureType}</span>
    </span>
  );
};

interface SinglePanelHeaderProps {
  title: string;
  modelCorrelation: number | null;
  screenType: string;
  isOpen: boolean
}

export const CollapsiblePanelHeader = ({
  title,
  modelCorrelation,
  screenType, // take out if not used
  isOpen
}: SinglePanelHeaderProps) => {
  console.log(screenType)
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.oneModel}>{
              <span
              style={{paddingRight: "8px", paddingTop: "3px", fontSize: "14px"}}
                className={isOpen ? "glyphicon glyphicon-chevron-up"
                : "glyphicon glyphicon-chevron-down"}
              />
            }{title}</span>
      <div className={styles.two}>
        {modelCorrelation && (
          <StyledMeter
            value={modelCorrelation}
            style={{ barColor: "#52288E", maxWidth: "180px", labelFontSize: "14px", labelLeftPosition: "90px" }}
            extraClassNames={"styled-correlation-box"}
            toFixed={3}
            showLabel
          />
        )}
      </div>
      <span className={styles.three}>
        <div className={styles.additionalInfo}>
          R between observed and predicted
        </div>
      </span>
    </span>
  );
};

interface FeatureCollapsiblePanelProps {
  modelName: string;
  feature: string;
  featureNameType: string; // The key to fetching the data
  featureType: string;
  geneSymbol: string;
  panelIndex: number;
  isOpen: boolean;
}

const FeatureCollapsiblePanels = ({
  modelName,
  feature,
  featureNameType,
  featureType,
  geneSymbol,
  panelIndex,
  isOpen,
}: FeatureCollapsiblePanelProps) => {
  const dapi = getDapi();

  return (
    <div
      style={{
        width: "100%",
      }}
    >

      
      <div className="collapsible-sub-panel-list">
        <div className={styles.featurePanel}>
          <div className={styles.featureGraph1}>
            {isOpen && (
              <FeatureVsGeneEffectPlot
                modelName={modelName}
                geneSymbol={geneSymbol}
                featureNameType={featureNameType}
                feature={feature}
                featureType={featureType}
                panelIndex={panelIndex}
                getFeatureVsGeneEffectData={dapi.getPredictabilityFeatureGeneEffectData.bind(
                  dapi
                )}
              />
            )}
          </div>
          <div className={styles.featureGraph2}>
            {isOpen && (
              <PredictabilityBoxPlot
                modelName={modelName}
                geneSymbol={geneSymbol}
                featureNameType={featureNameType}
                featureName={feature}
                featureType={featureType}
                panelIndex={panelIndex}
                getPredictabilityBoxPlotData={dapi.getPredictabilityBoxPlotData.bind(
                  dapi
                )}
              />
            )}
          </div>
          <div className={styles.featureGraph3}>
            {isOpen && (
              <RelatedFeaturesCorrPlot
                modelName={modelName}
                geneSymbol={geneSymbol}
                featureNameType={featureNameType}
                feature={feature}
                panelIndex={panelIndex}
                getRelatedFeaturesCorrPlotData={dapi.getRelatedFeatureCorrData.bind(
                  dapi
                )}
              />
            )}
          </div>
          <div className={styles.featureGraph4}>
            {isOpen && (
              <PredictabilityWaterfallPlot
                modelName={modelName}
                geneSymbol={geneSymbol}
                featureNameType={featureNameType}
                feature={feature}
                panelIndex={panelIndex}
                getWaterfallPlotData={dapi.getWaterfallData.bind(dapi)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureCollapsiblePanels;
