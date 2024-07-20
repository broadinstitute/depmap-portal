import React from "react";
import { DepmapApi } from "src/dAPI";
import { EntityType } from "src/entity/models/entities";

import PredictiveModelTable from "src/predictability/components/PredictiveModelTable";
import {
  PredictiveModelResults,
  ModelType,
  ScreenType,
} from "src/predictability/models/predictive";

const MODEL_FEATURE_SETS = {
  [ModelType.CoreOmics]:
    "Expression, Dam. Mut., Copy Number, Hot. Mut., Fusion, Lineage, Confounders",
  [ModelType.Related]:
    "Expression, Dam. Mut., Copy Number, Hot. Mut., Fusion, Lineage, Confounders",
  [ModelType.DNABased]:
    "Dam. Mut., Copy Number, Hot. Mut., Fusion, Lineage, Confounders",
  [ModelType.ExtendedOmics]:
    "Expression, Copy num., Dam. Mut., Fusion, Hot. Mut., Lineage, RPPA, Metabolomics, Confounders",
};

interface Props {
  dapi: DepmapApi;
  entityType: EntityType;
  screen: string;
  screenType: ScreenType;
  modelsAndResults: Array<PredictiveModelResults>;
}

export default function PredictiveModelsForScreen(props: Props) {
  const { dapi, entityType, screen, screenType, modelsAndResults } = props;
  return (
    <div>
      <div className="screen-label">{screen}</div>
      <div className="tables-headers">
        <div className={`model-label all-caps`}>{"Model"}</div>
        <div className="accuracy-label">
          <span className="all-caps">Accuracy Score</span> (Pearson)
        </div>
      </div>
      {modelsAndResults.map((modelAndResults, i) => {
        const { modelCorrelation, results } = modelAndResults;
        const { modelName } = modelAndResults;
        const tableTitle = modelName;
        const modelFeatureSets = MODEL_FEATURE_SETS[modelName];
        const key = tableTitle;

        return (
          <PredictiveModelTable
            key={key}
            dapi={dapi}
            entityType={entityType}
            screenType={screenType}
            modelName={tableTitle}
            modelFeatureSets={modelFeatureSets}
            modelCorrelation={modelCorrelation}
            results={results}
            defaultOpen={i === 0}
          />
        );
      })}
    </div>
  );
}
