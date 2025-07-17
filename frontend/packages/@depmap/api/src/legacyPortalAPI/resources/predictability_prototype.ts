import { getJson } from "../client";
import {
  PredictabilityData,
  RelatedFeaturePlot,
  PredictiveModelData,
  FeatureVsGeneEffectPlotData,
} from "@depmap/types";

export function getPredictabilityPrototypeData(gene_symbol: string) {
  return getJson<PredictabilityData>(
    `/api/predictability_prototype/predictions`,
    {
      gene_symbol,
    }
  );
}

export function getRelatedFeatureCorrData(
  entityLabel: string,
  identifier: string,
  model: string,
  screenType: string
) {
  return getJson<RelatedFeaturePlot>(
    `/api/predictability_prototype/feature/related_correlations`,
    {
      entity_label: entityLabel,
      identifier,
      model,
      screen_type: screenType,
    }
  );
}

export function getWaterfallData(
  entityLabel: string,
  identifier: string,
  model: string,
  screenType: string
) {
  return getJson<any>(`/api/predictability_prototype/feature/waterfall`, {
    entity_label: entityLabel,
    identifier,
    model,
    screen_type: screenType,
  });
}

export function getPredictabilityBoxOrBarPlotData(
  identifier: string,
  entityLabel: string,
  model: string,
  screenType: string
): Promise<any> {
  return getJson<any>(`/api/predictability_prototype/feature/boxbarplot`, {
    entity_label: entityLabel,
    identifier,
    model,
    screen_type: screenType,
  });
}

export function getModelPerformanceData(
  modelName: string,
  geneSymbol: string,
  screenType: string
): Promise<PredictiveModelData> {
  return getJson<PredictiveModelData>(
    `/api/predictability_prototype/model_performance`,
    {
      entity_label: geneSymbol,
      model: modelName,
      screen_type: screenType,
    }
  );
}

export function getPredictabilityFeatureGeneEffectData(
  identifier: string,
  featureIndex: number,
  entityLabel: string,
  model: string,
  screenType: string
) {
  return getJson<FeatureVsGeneEffectPlotData>(
    `/api/predictability_prototype/feature/gene_effect_data`,
    {
      identifier,
      feature_index: featureIndex,
      entity_label: entityLabel,
      model,
      screen_type: screenType,
    }
  );
}
//
// export function getPredictabilityPrototypeData(
//   gene_symbol: string
// ) {
//
//   return getJson<PredictabilityData>(
//     `/api/predictability_prototype/predictions`, {
//     gene_symbol,
//   }
//   );
// }
