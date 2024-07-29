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
}

export const FeatureCollapsiblePanelHeader = ({
  feature,
  relativeImportance,
  correlation,
  featureType,
}: FeatureSinglePanelHeaderProps) => {
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.one}>{feature}</span>
      <div className={styles.two}>
        {" "}
        {relativeImportance && (
          <StyledMeter
            value={relativeImportance}
            style={{ barColor: "#97C2D4" }}
            extraClassNames={"styled-correlation-box"}
          />
        )}
        <div style={{ marginLeft: "5px" }}>
          {relativeImportance?.toPrecision(3)}
        </div>
      </div>
      <span className={styles.three}>
        {" "}
        {correlation && (
          <StyledMeter
            value={correlation}
            style={{ barColor: "#E79E9D" }}
            extraClassNames={"styled-correlation-box"}
          />
        )}
        <div style={{ marginLeft: "5px" }}>{correlation?.toPrecision(3)}</div>
      </span>
      <span className={styles.four}>{featureType}</span>
    </span>
  );
};

interface SinglePanelHeaderProps {
  title: string;
  modelCorrelation: number | null;
  screenType: string;
}

export const CollapsiblePanelHeader = ({
  title,
  modelCorrelation,
  screenType, // take out if not used
}: SinglePanelHeaderProps) => {
  console.log(screenType)
  return (
    <span className={styles.accordionTitle}>
      <span className={styles.one}>{title}</span>
      <div className={styles.two}>
        {modelCorrelation && (
          <StyledMeter
            value={modelCorrelation}
            style={{ barColor: "#52288E" }}
            extraClassNames={"styled-correlation-box"}
          />
        )}
        <div style={{ marginLeft: "5px" }}>
          {modelCorrelation?.toPrecision(3)}
        </div>
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
        backgroundColor: "rgba(105, 124, 170, 0.05)",
        width: "100%",
      }}
    >

      
      <div className="collapsible-sub-panel-list">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            rowGap: "10px",
            columnGap: "10px",
            paddingBottom: "15px",
            background: "white",
          }}
        >
          <div
            style={{
              gridColumn: "1",
              gridRow: "1",
              border: "1px solid lightgray",
            }}
          >
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
          <div
            style={{
              gridColumn: "2",
              gridRow: "1",
              border: "1px solid lightgray",
              marginLeft: "10px",
            }}
          >
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
          <div
            style={{
              gridColumn: "3",
              gridRow: "1",
              border: "1px solid lightgray",
              height: 400,
            }}
          >
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
          <div
            style={{
              gridColumn: "1",
              gridRow: "2",
              border: "1px solid lightgray",
              height: "auto",
            }}
          >
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
