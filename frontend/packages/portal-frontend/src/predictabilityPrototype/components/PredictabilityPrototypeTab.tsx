import React, { useEffect, useState } from "react";
import {
  CardRow,
  CardRowContainer,
  CardRowItem,
} from "src/common/components/Card";
import { getDapi } from "src/common/utilities/context";
import { EntityType } from "src/entity/models/entities";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { CollapsiblePanelHeader } from "./FeatureCollapsiblePanels";
import {
  PredictabilityData,
  ScreenType,
  SCREEN_TYPE_COLORS,
} from "../models/types";
import { Panel, PanelGroup } from "react-bootstrap";
import ModelPerformancePanel from "./ModelPerformancePanel";

const AggScoresTile = React.lazy(
  () => import("src/predictabilityPrototype/components/AggScoresTile")
);
const TopFeaturesOverallTile = React.lazy(
  () => import("src/predictabilityPrototype/components/TopFeaturesOverallTile")
);
const GeneTeaTile = React.lazy(
  () => import("src/predictabilityPrototype/components/GeneTeaTile")
);

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

  const [data, setData] = useState<PredictabilityData | null>(null);
  const [geneTeaSymbols, setGeneTeaSymbols] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const dapi = getDapi();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const predictabilityData = await dapi.getPredictabilityPrototypeData(
        entityLabel
      );

      setData(predictabilityData);
      setGeneTeaSymbols(
        predictabilityData.crispr.overview.gene_tea_symbols.concat(
          predictabilityData.rnai.overview.gene_tea_symbols
        )
      );
      setIsLoading(false);
    })();
  }, [dapi, entityLabel]);
  console.log(isLoading);

  const [activeRNAiModelIndex, setActiveRNAiModelIndex] = useState<
    number | null
  >(null);
  const [activeCRISPRModelIndex, setActiveCRISPRModelIndex] = useState<
    number | null
  >(null);

  const handleModelAccordionClick = (index: number, screenType: ScreenType) =>
    screenType === ScreenType.RNAI
      ? setActiveRNAiModelIndex((prevIndex) =>
          prevIndex === index ? null : index
        )
      : setActiveCRISPRModelIndex((prevIndex) =>
          prevIndex === index ? null : index
        );

  return (
    <div>
      <div style={{ borderBottom: "1px solid #000000", marginBottom: "15px" }}>
        <CardRowContainer>
          <CardRow>
            <CardRowItem>
              <AggScoresTile
                plotTitle={`${entityLabel}`}
                crisprData={
                  data ? data.crispr.overview?.aggregated_scores : null
                }
                rnaiData={data ? data.rnai.overview?.aggregated_scores : null}
              />
            </CardRowItem>
            <CardRowItem>
              <TopFeaturesOverallTile
                plotTitle={`${entityLabel}`}
                topFeaturesData={
                  data ? data.crispr.overview?.top_features : null
                }
                entityLabel={entityLabel}
              />
            </CardRowItem>
            <CardRowItem>
              {geneTeaSymbols.length > 0 && (
                <GeneTeaTile selectedLabels={geneTeaSymbols} />
              )}
            </CardRowItem>
          </CardRow>
        </CardRowContainer>
      </div>
      <div>
        <div style={{ marginLeft: "12px" }}>
          <h3 style={{ marginTop: "22px" }}>Model Performance</h3>
          <p>Performance according to CRISPR and RNAi</p>
        </div>
      </div>
      <div className={styles.DataFilePanel}>
        <div className={styles.dataPanelSection}>
          {data && data[ScreenType.CRISPR].model_performance_info && (
            <h2 style={{ color: SCREEN_TYPE_COLORS.get(ScreenType.CRISPR) }}>
              CRISPR
            </h2>
          )}
          {data &&
            data[ScreenType.CRISPR].model_performance_info &&
            Object.keys(data[ScreenType.CRISPR].model_performance_info).map(
              (modelName: string, modelIndex: number) => (
                <PanelGroup
                  accordion
                  id="accordion-model"
                  onSelect={(index) =>
                    handleModelAccordionClick(index, ScreenType.CRISPR)
                  }
                  activeKey={activeCRISPRModelIndex}
                  key={`${modelName}-accordion-model-${modelIndex}`}
                >
                  <Panel eventKey={modelIndex} key={modelName}>
                    <Panel.Heading>
                      <Panel.Title toggle>
                        <div>
                          <CollapsiblePanelHeader
                            title={`Model: ${modelName}`}
                            modelCorrelation={
                              data[ScreenType.CRISPR].model_performance_info[
                                modelName
                              ].r
                            }
                            screenType={ScreenType.CRISPR}
                            isOpen={activeCRISPRModelIndex === modelIndex}
                          />
                        </div>
                      </Panel.Title>
                    </Panel.Heading>
                    <Panel.Body collapsible>
                      <ModelPerformancePanel
                        isOpen={activeCRISPRModelIndex === modelIndex}
                        modelName={modelName}
                        entityLabel={entityLabel}
                        screenType={ScreenType.CRISPR}
                        modelPerformanceInfo={
                          data[ScreenType.CRISPR].model_performance_info[
                            modelName
                          ]
                        }
                        getModelPerformanceData={dapi.getModelPerformanceData.bind(
                          dapi
                        )}
                      />
                    </Panel.Body>
                  </Panel>
                </PanelGroup>
              )
            )}
          {data && data[ScreenType.RNAI].model_performance_info && (
            <h2 style={{ color: SCREEN_TYPE_COLORS.get(ScreenType.RNAI) }}>
              RNAi
            </h2>
          )}
          {data &&
            data[ScreenType.RNAI].model_performance_info &&
            Object.keys(data[ScreenType.RNAI].model_performance_info).map(
              (modelName: string, modelIndex: number) => (
                <PanelGroup
                  accordion
                  id="accordion-model"
                  onSelect={(index) =>
                    handleModelAccordionClick(index, ScreenType.RNAI)
                  }
                  activeKey={activeRNAiModelIndex}
                  key={`${modelName}-accordion-model-${modelIndex}`}
                >
                  <Panel eventKey={modelIndex} key={modelName}>
                    <Panel.Heading>
                      <Panel.Title toggle>
                        <div>
                          <CollapsiblePanelHeader
                            title={`Model: ${modelName}`}
                            modelCorrelation={
                              data[ScreenType.RNAI].model_performance_info[
                                modelName
                              ].r
                            }
                            screenType={ScreenType.RNAI}
                            isOpen={activeRNAiModelIndex === modelIndex}
                          />
                        </div>
                      </Panel.Title>
                    </Panel.Heading>
                    <Panel.Body collapsible>
                      <ModelPerformancePanel
                        isOpen={activeRNAiModelIndex === modelIndex}
                        modelName={modelName}
                        entityLabel={entityLabel}
                        screenType={ScreenType.RNAI}
                        modelPerformanceInfo={
                          data[ScreenType.RNAI].model_performance_info[
                            modelName
                          ]
                        }
                        getModelPerformanceData={dapi.getModelPerformanceData.bind(
                          dapi
                        )}
                      />
                    </Panel.Body>
                  </Panel>
                </PanelGroup>
              )
            )}
        </div>
      </div>
    </div>
  );
};

export default PredictabilityPrototypeTab;
