import React from "react";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import StyledMeter from "src/common/components/StyledMeter";
import { toStaticUrl } from "@depmap/globals";
import PredictabilityWaterfallPlot from "./PredictabilityWaterfallPlot";
import RelatedFeaturesCorrPlot from "./RelatedFeaturesCorrPlot";
import PredictabilityBoxOrBarPlot from "./PredictabilityBoxOrBarPlot";
import FeatureVsGeneEffectPlot from "./FeatureVsGeneEffectPlot";
import { SCREEN_TYPE_COLORS } from "../models/types";
import { RelatedType } from "@depmap/types/src/predictability";
import { legacyPortalAPI } from "@depmap/api";

interface FeatureSinglePanelHeaderProps {
  feature: string;
  relativeImportance: number;
  correlation: number;
  featureTypeLabel: string;
  relatedType: RelatedType | null;
  isOpen: boolean;
}

export const FeatureCollapsiblePanelHeader = ({
  feature,
  relativeImportance,
  correlation,
  featureTypeLabel,
  relatedType,
  isOpen,
}: FeatureSinglePanelHeaderProps) => {
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.one}>
        {
          <span
            style={{ paddingRight: "8px", paddingTop: "3px", fontSize: "12px" }}
            className={
              isOpen
                ? "glyphicon glyphicon-chevron-up"
                : "glyphicon glyphicon-chevron-down"
            }
          />
        }
        {feature}
        {relatedType && (
          <span className="related-icon-container">
            <img
              style={{
                height: "16px",
                paddingBottom: "3px",
                paddingLeft: "5px",
              }}
              src={toStaticUrl(`/static/img/predictability/${relatedType}.svg`)}
              alt={relatedType}
            />
          </span>
        )}
      </span>

      <div className={styles.two}>
        {" "}
        {relativeImportance && (
          <StyledMeter
            value={relativeImportance}
            style={{
              barColor: "#97C2D4",
              maxWidth: "120px",
              labelFontSize: "14px",
              labelLeftPosition: "70px",
            }}
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
            style={{
              barColor: "#E79E9D",
              maxWidth: "120px",
              labelFontSize: "14px",
              labelLeftPosition: "70px",
            }}
            extraClassNames={"styled-correlation-box"}
            toFixed={3}
            showLabel
          />
        )}
      </span>
      <span className={styles.four}>{featureTypeLabel}</span>
    </span>
  );
};

interface SinglePanelHeaderProps {
  title: string;
  modelCorrelation: number | null;
  screenType: string;
  isOpen: boolean;
}

export const CollapsiblePanelHeader = ({
  title,
  modelCorrelation,
  screenType,
  isOpen,
}: SinglePanelHeaderProps) => {
  console.log(screenType);
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.oneModel}>
        {
          <span
            style={{ paddingRight: "8px", paddingTop: "3px", fontSize: "14px" }}
            className={
              isOpen
                ? "glyphicon glyphicon-chevron-up"
                : "glyphicon glyphicon-chevron-down"
            }
          />
        }
        {title}
      </span>
      <div className={styles.two}>
        {modelCorrelation && (
          <StyledMeter
            value={modelCorrelation}
            style={{
              barColor: SCREEN_TYPE_COLORS.get(screenType),
              maxWidth: "180px",
              labelFontSize: "14px",
              labelLeftPosition: "90px",
            }}
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
  dimType: string;
  geneSymbol: string;
  panelIndex: number;
  isOpen: boolean;
  screenType: string;
  givenId: string;
  datasetId: string;
  actualsDatasetId: string;
}

// We don't have TCGA data loaded at this time, so don't show this plot yet.
const showTumorModelComparison = false;

const FeatureCollapsiblePanels = ({
  modelName,
  feature,
  featureNameType,
  dimType,
  geneSymbol,
  panelIndex,
  isOpen,
  screenType,
  actualsDatasetId,
  datasetId,
  givenId,
}: FeatureCollapsiblePanelProps) => {
  return (
    <div
      style={{
        width: "100%",
      }}
    >
      <div className="collapsible-sub-panel-list">
        <div className={styles.featurePanel}>
          {isOpen && (
            <>
              <div className={styles.featureGraph1}>
                <FeatureVsGeneEffectPlot
                  modelName={modelName}
                  geneSymbol={geneSymbol}
                  featureNameType={featureNameType}
                  feature={feature}
                  dimType={dimType}
                  panelIndex={panelIndex}
                  screenType={screenType}
                  getFeatureVsGeneEffectData={
                    legacyPortalAPI.getPredictabilityFeatureGeneEffectData
                  }
                />
              </div>
              {showTumorModelComparison && (
                <div className={styles.featureGraph2}>
                  <PredictabilityBoxOrBarPlot
                    modelName={modelName}
                    geneSymbol={geneSymbol}
                    featureNameType={featureNameType}
                    featureName={feature}
                    dimType={dimType}
                    panelIndex={panelIndex}
                    screenType={screenType}
                    getPredictabilityBoxPlotData={
                      legacyPortalAPI.getPredictabilityBoxOrBarPlotData
                    }
                  />
                </div>
              )}
              <div className={styles.featureGraph2}>
                <RelatedFeaturesCorrPlot
                  modelName={modelName}
                  geneSymbol={geneSymbol}
                  featureNameType={featureNameType}
                  feature={feature}
                  panelIndex={panelIndex}
                  screenType={screenType}
                  getRelatedFeaturesCorrPlotData={
                    legacyPortalAPI.getRelatedFeatureCorrData
                  }
                />
              </div>
              <div className={styles.featureGraph3}>
                <PredictabilityWaterfallPlot
                  actualsDatasetId={actualsDatasetId}
                  datasetId={datasetId}
                  givenId={givenId}
                />
              </div>{" "}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureCollapsiblePanels;
