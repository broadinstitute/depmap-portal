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
  GeneTeaSearchTerm,
  PredData,
  ScreenType,
  SCREEN_TYPE_COLORS,
} from "../models/types";
import { Panel, PanelGroup } from "react-bootstrap";
import ModelPerformancePanel from "./ModelPerformancePanel";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import PlotlyLoader from "../../plot/components/PlotlyLoader";

const AggScoresTile = React.lazy(
  () => import("src/predictabilityPrototype/components/AggScoresTile")
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

  const [data, setData] = useState<PredData | null>(null);
  const [geneTeaSymbolsCRISPR, setGeneTeaSymbolsCRISPR] = useState<
    GeneTeaSearchTerm[]
  >([]);
  const [geneTeaSymbolsRNAi, setGeneTeaSymbolsRNAi] = useState<
    GeneTeaSearchTerm[]
  >([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const dapi = getDapi();

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      const predictabilityData = await dapi
        .getPredictabilityPrototypeData(entityLabel)
        .catch((e) => {
          window.console.error(e);
          setIsError(true);
          setError(e);
        });

      if (
        predictabilityData &&
        predictabilityData.error_message &&
        predictabilityData.error_message !== ""
      ) {
        setIsError(true);
        setError(predictabilityData.error_message);
      } else if (predictabilityData && !predictabilityData.error_message) {
        setData(predictabilityData.data);
        setGeneTeaSymbolsCRISPR(
          predictabilityData.data.crispr.overview.gene_tea_symbols
        );
        setGeneTeaSymbolsRNAi(
          predictabilityData.data.rnai.overview.gene_tea_symbols
        );
      }

      setIsLoading(false);
    })();
  }, [dapi, entityLabel, isError]);
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
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <div>
        {isError && error && (
          <h4 style={{ color: "red" }}>Error: {String(error)}</h4>
        )}
        {!isError && (
          <div
            style={{ borderBottom: "1px solid #000000", marginBottom: "15px" }}
          >
            <CardRowContainer>
              <CardRow>
                <CardRowItem>
                  <AggScoresTile
                    plotTitle={`${entityLabel}`}
                    crisprData={
                      data ? data.crispr.overview?.aggregated_scores : null
                    }
                    rnaiData={
                      data ? data.rnai.overview?.aggregated_scores : null
                    }
                  />
                </CardRowItem>
                <CardRowItem>
                  {geneTeaSymbolsCRISPR && (
                    <GeneTeaTile
                      selectedLabels={geneTeaSymbolsCRISPR}
                      screenTypeLabel={"CRISPR"}
                      entityLabel={entityLabel}
                      topFeaturesData={
                        data ? data.crispr.overview?.top_features : null
                      }
                    />
                  )}
                </CardRowItem>
                <CardRowItem>
                  {geneTeaSymbolsRNAi && (
                    <GeneTeaTile
                      selectedLabels={geneTeaSymbolsRNAi}
                      screenTypeLabel={"RNAi"}
                      entityLabel={entityLabel}
                      topFeaturesData={
                        data ? data.rnai.overview?.top_features : null
                      }
                    />
                  )}
                </CardRowItem>
              </CardRow>
            </CardRowContainer>
          </div>
        )}
        {!isError && (
          <div>
            <div style={{ marginLeft: "12px" }}>
              <h3 style={{ marginTop: "22px" }}>Model Performance</h3>
              <p>Performance according to CRISPR and RNAi</p>
            </div>
          </div>
        )}
        {!isError && (
          <div className={styles.DataFilePanel}>
            <div className={styles.dataPanelSection}>
              {data && data[ScreenType.CRISPR].model_performance_info && (
                <h2
                  style={{ color: SCREEN_TYPE_COLORS.get(ScreenType.CRISPR) }}
                >
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
                                  data[ScreenType.CRISPR]
                                    .model_performance_info[modelName].r
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
                            entityType={entityType}
                            screenType={ScreenType.CRISPR}
                            dapi={dapi}
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
                            entityType={entityType}
                            dapi={dapi}
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
        )}
      </div>
    </PlotlyLoaderProvider>
  );
};

export default PredictabilityPrototypeTab;
