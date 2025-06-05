enum RelatedType {
  Self = "self",
  Related = "related",
  Target = "target",
}

interface PredictiveModelResultsBase {
  modelCorrelation: number;
  results: Array<PredictiveFeatureResult>;
  modelName: ModelType;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GenePredictiveModelResults
  extends PredictiveModelResultsBase {}

export interface CompoundDosePredictiveModelResults
  extends PredictiveModelResultsBase {
  compoundExperimentId: string;
}

export type PredictiveModelResults =
  | GenePredictiveModelResults
  | CompoundDosePredictiveModelResults;

export interface PredictiveFeatureResult {
  featureName: string;
  featureImportance: number;
  correlation: number;
  featureType: string;
  relatedType: RelatedType;
  interactiveUrl: string;
}

export interface PredictabilityTable {
  screen: string;
  screenType: ScreenType;
  modelsAndResults: Array<PredictiveModelResults>;
  compoundExperimentId?: string;
}

export enum ModelType {
  CoreOmics = "Core Omics",
  ExtendedOmics = "Extended Omics",
  DNABased = "DNA-based",
  Related = "Related",
}

export enum ScreenType {
  CRISPR = "crispr",
  RNAi = "rnai",
  Compound = "compound",
}
