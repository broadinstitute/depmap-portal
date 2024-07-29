import React, { useEffect, useState } from "react";
import { CardColumn, CardContainer } from "src/common/components/Card";
import { getDapi } from "src/common/utilities/context";
import { EntityType } from "src/entity/models/entities";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import FeatureCollapsiblePanel, {
  CollapsiblePanelHeader,
  FeatureCollapsiblePanelHeader,
} from "./FeatureCollapsiblePanels";
import {
  AggScoresData,
  ModelPerformanceData,
  TopFeaturesBarData,
} from "../models/types";
import ModelPerformancePlots from "./ModelPerformancePlots";
import { Panel, PanelGroup } from "react-bootstrap";

const AggScoresTile = React.lazy(
  () => import("src/predictabilityPrototype/components/AggScoresTile")
);
const TopFeaturesOverallTile = React.lazy(
  () => import("src/predictabilityPrototype/components/TopFeaturesOverallTile")
);
// const GeneTeaTile = React.lazy(
//   () => import("src/predictabilityPrototype/components/GeneTeaTile")
// );

export interface PredictabilityPrototypeProps {
  entityIdOrLabel: number | string;
  entityLabel: string;
  entityType: EntityType;
  customDownloadsLink: string;
  methodologyUrl: string;
}

const PredictabilityPrototypeTab = ({
  entityIdOrLabel,
  entityLabel,
  entityType,
  customDownloadsLink,
  methodologyUrl,
}: PredictabilityPrototypeProps) => {
  console.log(entityIdOrLabel);
  console.log(entityLabel);
  console.log(entityType);
  console.log(customDownloadsLink);
  console.log(methodologyUrl);

  const [aggScoresData, setAggScoresData] = useState<AggScoresData | null>(
    null
  );

  const [
    topFeaturesData,
    setTopFeaturesData,
  ] = useState<TopFeaturesBarData | null>(null);

  const [geneTeaSymbols, setGeneTeaSymbols] = useState<string[]>([]);

  const [
    modelPerformanceData,
    setModelPerformanceData,
  ] = useState<ModelPerformanceData | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const dapi = getDapi();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const data = await dapi.getPredictabilityPrototypeData(entityLabel);

      setAggScoresData(data.overview.aggregated_scores);
      setTopFeaturesData(data.overview.top_features);
      setGeneTeaSymbols(data.overview.gene_tea_symbols);
      setModelPerformanceData(data.model_performance_data);
      setIsLoading(false);
    })();
  }, [dapi, entityLabel]);
  console.log(isLoading)
  console.log(geneTeaSymbols)

  const [activeModelIndex, setActiveModelIndex] = useState<number | null>(null);

  const handleModelAccordionClick = (index: number) => {
    setActiveModelIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  const [activeFeatureIndex, setActiveFeatureIndex] = useState<number | null>(
    null
  );

  const handleFeatureAccordionClick = (index: number) => {
    setActiveFeatureIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  return (
    <div>
      <CardContainer>
        <CardColumn>
          <AggScoresTile plotTitle={`${entityLabel}`} data={aggScoresData} />
        </CardColumn>
        <CardColumn>
          <TopFeaturesOverallTile
            plotTitle={`${entityLabel}`}
            topFeaturesData={topFeaturesData}
          />
        </CardColumn>
        <CardColumn>
          <div>placeholder for gene tea</div>
        </CardColumn>
      </CardContainer>
      <div className={styles.DataFilePanel}>
        <div className={styles.dataPanelSection}>
          <>
            {modelPerformanceData &&
              Object.keys(modelPerformanceData).map(
                (modelName: string, modelIndex: number) => (
                  <PanelGroup
                    accordion
                    id="accordion-model"
                    onSelect={(index) => handleModelAccordionClick(index)}
                    activeKey={activeModelIndex}
                    key={`${modelName}-accordion-model-${modelIndex}`}
                  >
                    <Panel eventKey={modelIndex} key={modelName}>
                      <Panel.Heading>
                        <Panel.Title toggle>
                          <div>
                            <CollapsiblePanelHeader
                              title={modelName}
                              modelCorrelation={
                                modelPerformanceData[modelName].r
                              }
                              screenType={""}
                            />
                          </div>
                        </Panel.Title>
                      </Panel.Heading>
                      <Panel.Body collapsible>
                        <ModelPerformancePlots
                          modelPredData={
                            modelPerformanceData[modelName].model_predictions
                          }
                          cellContextCorrData={
                            modelPerformanceData[modelName].corr
                          }
                        />
                                <div
          style={{
            backgroundColor: "rgba(105, 124, 170, 0.05)",
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
                          onSelect={(index) =>
                            handleFeatureAccordionClick(index)
                          }
                          activeKey={activeFeatureIndex}
                        >
                          {modelPerformanceData[modelName] &&
                            modelPerformanceData[modelName].feature_summaries &&
                            Object.keys(
                              modelPerformanceData[modelName].feature_summaries
                            ).map((feature, featureIndex) => (
                              <Panel
                                eventKey={featureIndex}
                                key={`${modelPerformanceData[modelName].feature_summaries.feature_name}${modelName}`}
                              >
                                <Panel.Heading>
                                  <Panel.Title toggle>
                                    <div>
                                      <FeatureCollapsiblePanelHeader
                                        feature={
                                          modelPerformanceData[modelName]
                                            .feature_summaries[feature]
                                            .feature_name
                                        }
                                        relativeImportance={
                                          modelPerformanceData[modelName]
                                            .feature_summaries[feature]
                                            .feature_importance
                                        }
                                        correlation={
                                          modelPerformanceData[modelName]
                                            .feature_summaries[feature].pearson
                                        }
                                        featureType={
                                          modelPerformanceData[modelName]
                                            .feature_summaries[feature]
                                            .feature_type
                                        }
                                      />
                                    </div>
                                  </Panel.Title>
                                </Panel.Heading>
                                <Panel.Body collapsible>
                                  <div>
                                    {modelPerformanceData[modelName]
                                      .feature_summaries[feature] && (

                                      <FeatureCollapsiblePanel
                                        modelName={modelName}
                                        feature={
                                          modelPerformanceData[modelName]
                                            .feature_summaries[feature]
                                            .feature_name
                                        }
                                        featureNameType={feature}
                                        featureType={
                                          modelPerformanceData[modelName]
                                            .feature_summaries[feature]
                                            .feature_type
                                        }
                                        geneSymbol={entityLabel}
                                        panelIndex={featureIndex}
                                        isOpen={
                                          modelIndex === activeModelIndex &&
                                          featureIndex === activeFeatureIndex
                                        }
                                      />
                                    )}
                                  </div>
                                </Panel.Body>
                              </Panel>
                            ))}
                        </PanelGroup>
                        </div>
                      </Panel.Body>
                    </Panel>
                  </PanelGroup>

                )
                
              )}
          </>
        </div>
      </div>
    </div>
  );
};

export default PredictabilityPrototypeTab;
