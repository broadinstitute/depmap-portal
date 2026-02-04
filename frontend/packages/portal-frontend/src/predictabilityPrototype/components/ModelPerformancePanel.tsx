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
  actualsDatasetId: string;
  actualsGivenId: string;
  predictionDatasetId: string;
  predictionGivenId: string;
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
  actualsDatasetId,
  actualsGivenId,
  predictionDatasetId,
  predictionGivenId,
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
          actualsDatasetId={actualsDatasetId}
          actualsGivenId={actualsGivenId}
          predictionDatasetId={predictionDatasetId}
          predictionGivenId={predictionGivenId}
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
            modelPerformanceInfo.feature_summaries.map(
              (feature_summary, featureIndex) => (
                <Panel
                  eventKey={featureIndex}
                  key={`${feature_summary.dataset_id}-${feature_summary.given_id}`}
                >
                  <Panel.Heading>
                    <Panel.Title toggle>
                      <div>
                        <FeatureCollapsiblePanelHeader
                          // givenId={feature_summary.given_id}
                          // datasetId={feature_summary.dataset_id}
                          feature={feature_summary.feature_label}
                          relativeImportance={
                            feature_summary.feature_importance
                          }
                          correlation={feature_summary.pearson}
                          featureTypeLabel={feature_summary.feature_type}
                          relatedType={feature_summary.related_type}
                          isOpen={activeFeatureIndex === featureIndex}
                        />
                      </div>
                    </Panel.Title>
                  </Panel.Heading>
                  <Panel.Body collapsible>
                    <div>
                      {feature_summary && (
                        <FeatureCollapsiblePanel
                          actualsDatasetId={actualsDatasetId}
                          givenId={feature_summary.given_id}
                          datasetId={feature_summary.dataset_id}
                          actualsGivenId={actualsGivenId}
                          modelName={modelName}
                          feature={feature_summary.feature_label}
                          featureNameType={feature_summary.feature_type}
                          dimType={feature_summary.dim_type}
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
