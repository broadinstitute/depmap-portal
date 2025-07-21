import React, { useState } from "react";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { ModelPerformanceInfo, PredictiveModelData } from "@depmap/types";
import { Panel, PanelGroup } from "react-bootstrap";
import FeatureCollapsiblePanel, {
  FeatureCollapsiblePanelHeader,
} from "./FeatureCollapsiblePanels";
import ModelPerformancePlots from "./ModelPerformancePlots";
import InfoIcon from "src/common/components/InfoIcon";
import { toStaticUrl } from "@depmap/globals";

interface ModelPerformancePanelProps {
  modelName: string;
  entityLabel: string;
  modelPerformanceInfo: ModelPerformanceInfo;
  screenType: string;
  entityType: string;
  getModelPerformanceData: (
    entityLabel: string,
    model: string,
    screenType: string
  ) => Promise<PredictiveModelData>;
  isOpen: boolean;
}

const getRelationshipDescription = (featureType: string) => {
  return featureType === "gene" ? (
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={toStaticUrl("/static/img/predictability/self.svg")}
          alt=""
          style={{ height: 12, marginInlineEnd: 4 }}
        />
        Self
      </div>
      <p>
        Features that correspond to measurements of the same gene as the
        dependency being predicted (Lin and Confounders are still included).
      </p>

      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={toStaticUrl("/static/img/predictability/related.svg")}
          alt=""
          style={{ height: 12, marginInlineEnd: 4 }}
        />
        Related
      </div>
      <p>
        Features that are connected to the target gene dependency by PPI
        (inweb), members of the same protein complex (CORUM), or paralogs based
        on DNA sequence analysis from Ensembl (Lin and Confounders are still
        included).
      </p>
    </>
  ) : (
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={toStaticUrl("/static/img/predictability/target.svg")}
          alt=""
          style={{ height: 12, marginInlineEnd: 4 }}
        />
        Target
      </div>
      <p>
        Annotated drug target in{" "}
        <a
          href="https://clue.io/repurposing-app"
          target="_blank"
          rel="noreferrer noopener"
        >
          Repurposing hub
        </a>
      </p>
    </>
  );
};

const ModelPerformancePanel = ({
  modelName,
  entityLabel,
  entityType,
  modelPerformanceInfo,
  screenType,
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
          screenType={screenType}
          getModelPerformanceData={getModelPerformanceData}
        />
      )}
      <div
        style={{
          paddingTop: "30px",
        }}
        className={styles.filePanelHeader}
      >
        <div className={styles.headerColOne}>
          FEATURE{" "}
          <span>
            <InfoIcon
              popoverContent={getRelationshipDescription(entityType)}
              popoverId={`relationship-popover-${screenType}-${modelName}`}
              trigger="click"
            />
          </span>
        </div>
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
                  key={`${modelPerformanceInfo.feature_summaries[feature].feature_label}${modelName}${screenType}`}
                >
                  <Panel.Heading>
                    <Panel.Title toggle>
                      <div>
                        <FeatureCollapsiblePanelHeader
                          feature={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_label
                          }
                          relativeImportance={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_importance
                          }
                          correlation={
                            modelPerformanceInfo.feature_summaries[feature]
                              .pearson
                          }
                          featureTypeLabel={
                            modelPerformanceInfo.feature_summaries[feature]
                              .feature_type
                          }
                          relatedType={
                            modelPerformanceInfo.feature_summaries[feature]
                              .related_type
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
                              .feature_label
                          }
                          featureNameType={feature}
                          dimType={
                            modelPerformanceInfo.feature_summaries[feature]
                              .dim_type
                          }
                          geneSymbol={entityLabel}
                          panelIndex={featureIndex}
                          screenType={screenType}
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
