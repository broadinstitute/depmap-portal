import React, { useState } from "react";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { ModelPerformanceInfo, PredictiveModelData } from "../models/types";
import { Panel, PanelGroup } from "react-bootstrap";
import FeatureCollapsiblePanel, {
  FeatureCollapsiblePanelHeader,
} from "./FeatureCollapsiblePanels";
import ModelPerformancePlots from "./ModelPerformancePlots";

interface ModelPerformancePanelProps {
  modelName: string;
  entityLabel: string;
  modelPerformanceInfo: ModelPerformanceInfo;
  getModelPerformanceData: (
    screenType: string,
    entityLabel: string,
    model: string
  ) => Promise<PredictiveModelData>;
  isOpen: boolean;
}

const ModelPerformancePanel = ({
  modelName,
  entityLabel,
  modelPerformanceInfo,
  getModelPerformanceData,
  isOpen,
}: ModelPerformancePanelProps) => {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState<number | null>(
    null
  );

  const handleFeatureAccordionClick = (index: number) => {
    setActiveFeatureIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  return (
    <>
      {isOpen && (
        <ModelPerformancePlots
          modelName={modelName}
          entityLabel={entityLabel}
          getModelPerformanceData={getModelPerformanceData}
        />
      )}
      <div
        style={{
          paddingTop: "30px",
        }}
        className={styles.filePanelHeader}
      >
        <div className={styles.headerColOne}>FEATURE</div>
        <div className={styles.headerColTwo}>RELATIVE IMPORTANCE</div>

        <div className={styles.headerColThree}>CORRELATION</div>
        <div className={styles.headerColFour}>FEATURE TYPE</div>

        <PanelGroup
          accordion
          id="accordion-feature"
          onSelect={(index) => handleFeatureAccordionClick(index)}
          activeKey={activeFeatureIndex}
        >
          {modelPerformanceInfo.feature_summaries &&
            Object.keys(modelPerformanceInfo.feature_summaries).map(
              (feature, featureIndex) => (
                <Panel
                  eventKey={featureIndex}
                  key={`${modelPerformanceInfo.feature_summaries[feature].feature_name}${modelName}`}
                >
                  <Panel.Heading>
                    <Panel.Title toggle>
                      <div>
                        <FeatureCollapsiblePanelHeader
                          feature={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_name
                          }
                          relativeImportance={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_importance
                          }
                          correlation={
                            modelPerformanceInfo.feature_summaries[feature]
                              .pearson
                          }
                          featureType={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_type
                          }
                          isOpen={activeFeatureIndex === featureIndex}
                        />
                      </div>
                    </Panel.Title>
                  </Panel.Heading>
                  <Panel.Body collapsible>
                    <div>
                      {modelPerformanceInfo.feature_summaries[feature] && (
                        <FeatureCollapsiblePanel
                          modelName={modelName}
                          feature={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_name
                          }
                          featureNameType={feature}
                          featureType={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_type
                          }
                          geneSymbol={entityLabel}
                          panelIndex={featureIndex}
                          isOpen={isOpen && featureIndex === activeFeatureIndex}
                        />
                      )}
                    </div>
                  </Panel.Body>
                </Panel>
              )
            )}
        </PanelGroup>
      </div>
    </>
  );
};

export default ModelPerformancePanel;
