import React, { useEffect, useState } from "react";
import {
  CardRow,
  CardRowContainer,
  CardRowItem,
} from "src/common/components/Card";
import { EntityType } from "src/entity/models/entities";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { CollapsiblePanelHeader } from "./FeatureCollapsiblePanels";
import { ScreenType, SCREEN_TYPE_COLORS } from "../models/types";
import { GeneTeaSearchTerm, PredData } from "@depmap/types";
import { Panel, PanelGroup } from "react-bootstrap";
import ModelPerformancePanel from "./ModelPerformancePanel";
import { PlotlyLoaderProvider } from "@depmap/data-explorer-2";
import PlotlyLoader from "../../plot/components/PlotlyLoader";
import { legacyPortalAPI } from "@depmap/api";

interface ScreenTypeModelPerformanceSectionProps {
  screenType: ScreenType;
  data: PredData;
  entityLabel: string;
  entityType: EntityType;
  activeModelIndex: number | null;
  onModelAccordionClick: (index: number, screenType: ScreenType) => void;
}

const ScreenTypeModelPerformanceSection = ({
  screenType,
  data,
  entityLabel,
  entityType,
  activeModelIndex,
  onModelAccordionClick,
}: ScreenTypeModelPerformanceSectionProps) => {
  const modelPerformanceInfo = data[screenType].model_performance_info;

  if (!modelPerformanceInfo) {
    return null;
  }

  return (
    <>
      <h2 style={{ color: SCREEN_TYPE_COLORS.get(screenType) }}>
        {screenType === ScreenType.CRISPR ? "CRISPR" : "RNAi"}
      </h2>
      {Object.keys(modelPerformanceInfo).map(
        (modelName: string, modelIndex: number) => {
          const mpi = modelPerformanceInfo[modelName];
          console.log("mpi", mpi);
          return (
            <PanelGroup
              accordion
              id="accordion-model"
              onSelect={(index) => onModelAccordionClick(index, screenType)}
              activeKey={activeModelIndex}
              key={`${modelName}-accordion-model-${modelIndex}`}
            >
              <Panel eventKey={modelIndex} key={modelName}>
                <Panel.Heading>
                  <Panel.Title toggle>
                    <div>
                      <CollapsiblePanelHeader
                        title={`Model: ${modelName}`}
                        modelCorrelation={mpi.r}
                        screenType={screenType}
                        isOpen={activeModelIndex === modelIndex}
                      />
                    </div>
                  </Panel.Title>
                </Panel.Heading>
                <Panel.Body collapsible>
                  <ModelPerformancePanel
                    isOpen={activeModelIndex === modelIndex}
                    modelName={modelName}
                    entityLabel={entityLabel}
                    entityType={entityType}
                    screenType={screenType}
                    modelPerformanceInfo={mpi}
                    getModelPerformanceData={
                      legacyPortalAPI.getModelPerformanceData
                    }
                    actualsDatasetId={mpi.actuals_dataset_id}
                    actualsGivenId={mpi.actuals_given_id}
                    predictionDatasetId={mpi.predictions_dataset_id}
                    predictionGivenId={mpi.predictions_given_id}
                  />
                </Panel.Body>
              </Panel>
            </PanelGroup>
          );
        }
      )}
    </>
  );
};

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

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      const predictabilityData = await legacyPortalAPI
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
  }, [entityLabel, isError]);
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
            style={{
              borderBottom: "1px solid #000000",
              marginBottom: "15px",
            }}
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
        {!isError && data && (
          <div className={styles.DataFilePanel}>
            <div className={styles.dataPanelSection}>
              <ScreenTypeModelPerformanceSection
                screenType={ScreenType.CRISPR}
                data={data}
                entityLabel={entityLabel}
                entityType={entityType}
                activeModelIndex={activeCRISPRModelIndex}
                onModelAccordionClick={handleModelAccordionClick}
              />
              <ScreenTypeModelPerformanceSection
                screenType={ScreenType.RNAI}
                data={data}
                entityLabel={entityLabel}
                entityType={entityType}
                activeModelIndex={activeRNAiModelIndex}
                onModelAccordionClick={handleModelAccordionClick}
              />
            </div>
          </div>
        )}
      </div>
    </PlotlyLoaderProvider>
  );
};

export default PredictabilityPrototypeTab;
