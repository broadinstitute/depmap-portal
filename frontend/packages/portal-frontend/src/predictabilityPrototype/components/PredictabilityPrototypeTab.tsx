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
  AggScoresData,
  ModelPerformanceInfo,
  TopFeaturesBarData,
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

  const [aggScoresData, setAggScoresData] = useState<AggScoresData | null>(
    null
  );

  const [
    topFeaturesData,
    setTopFeaturesData,
  ] = useState<TopFeaturesBarData | null>(null);

  const [modelPerformanceInfo, setModelPerformanceInfo] = useState<{
    [key: string]: ModelPerformanceInfo;
  } | null>(null);

  const [geneTeaSymbols, setGeneTeaSymbols] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const dapi = getDapi();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const data = await dapi.getPredictabilityPrototypeData(entityLabel);

      setAggScoresData(data.overview.aggregated_scores);
      setTopFeaturesData(data.overview.top_features);
      setGeneTeaSymbols(data.overview.gene_tea_symbols);
      setModelPerformanceInfo(data.model_performance_info);
      setIsLoading(false);
    })();
  }, [dapi, entityLabel]);
  console.log(isLoading);

  const [activeModelIndex, setActiveModelIndex] = useState<number | null>(null);

  const handleModelAccordionClick = (index: number) => {
    setActiveModelIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  console.log({ modelPerformanceInfo });
  return (
    <div>
      <div style={{ borderBottom: "1px solid #000000", marginBottom: "15px" }}>
        <CardRowContainer>
          <CardRow>
            <CardRowItem>
              <AggScoresTile
                plotTitle={`${entityLabel}`}
                data={aggScoresData}
              />
            </CardRowItem>
            <CardRowItem>
              <TopFeaturesOverallTile
                plotTitle={`${entityLabel}`}
                topFeaturesData={topFeaturesData}
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
          <>
            {modelPerformanceInfo &&
              Object.keys(modelPerformanceInfo).map(
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
                              title={`Model: ${modelName}`}
                              modelCorrelation={90}
                              screenType={""}
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
                          modelPerformanceInfo={modelPerformanceInfo[modelName]}
                          getModelPerformanceData={dapi.getModelPerformanceData.bind(
                            dapi
                          )}
                        />
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
