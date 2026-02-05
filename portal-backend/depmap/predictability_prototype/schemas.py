from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel
from enum import Enum


class RelatedType(str, Enum):
    Self = ("self",)
    Related = ("related",)
    Target = ("target",)


class TopFeaturesBarDataInner(BaseModel):
    feature: List[str]
    adj_feature_importance: List[float]
    dim_type: List[str]
    feature_set: List[str]
    model_name: List[str]


class TopFeaturesBarData(BaseModel):
    data: TopFeaturesBarDataInner
    x_axis_label: str
    y_axis_label: str


class ModelPredictionsGraphDataInner(BaseModel):
    predictions: List[float]
    actuals: List[float]


class CorrData(BaseModel):
    corr_heatmap_vals: List[List[float]]
    row_labels: List[str]
    gene_symbol_feature_types: Dict[str, str]
    feature_names: List[str]
    feature_types: List[str]


class FeatureVsGeneEffectPlotData(BaseModel):
    actuals_slice: List[float]
    feature_dataset_id: str
    feature_actuals_values: List[float]
    feature_actuals_value_labels: List[str]
    density: List[float]
    x_axis_label: str
    y_axis_label: str


class FeatureInfoSummary(BaseModel):
    actuals_slice: List[float]
    feature_name: str
    feature_type_label: str
    dim_type: str
    feature_importance: float
    pearson: float


class RelatedFeaturePlot(BaseModel):
    x: List[float]
    x_index: Optional[List[str]] = None
    y: List[float]
    y_index: Optional[List[str]] = None
    density: Optional[List[float]] = None
    x_label: str
    y_label: str


class FeatureInfo(BaseModel):
    featureSummary: FeatureInfoSummary
    relatedFeaturePlot: RelatedFeaturePlot
    waterfallPlot: RelatedFeaturePlot


class RelatedFeaturesScatterPlots(BaseModel):
    __root__: Dict[str, RelatedFeaturePlot]


class FeatureWaterfallPlots(BaseModel):
    __root__: Dict[str, RelatedFeaturePlot]


class PredictiveModelData(BaseModel):
    corr: CorrData


class AccuraciesData(BaseModel):
    name: List[str]
    accuracy: List[float]
    feature_highest_importance: Dict[str, List[str]]


class AggScoresData(BaseModel):
    accuracies: AccuraciesData
    x_axis_label: str
    y_axis_label: str


class GeneTeaSearchTerm(BaseModel):
    name: str
    feature_type_label: str
    importance_rank: int


class FeatureSummary(BaseModel):
    dataset_id: str
    given_id: str
    feature_label: str
    feature_type: str
    dim_type: str
    feature_importance: float
    related_type: Optional[RelatedType] = None
    pearson: float


class ModelPerformanceInfo(BaseModel):
    r: float
    feature_summaries: List[FeatureSummary]

    # the feature with the values we're trying to predict
    actuals_given_id: str
    actuals_dataset_id: str

    # the predictions from the model
    predictions_dataset_id: str
    predictions_given_id: str


class OverviewData(BaseModel):
    aggregated_scores: AggScoresData
    top_features: TopFeaturesBarData
    gene_tea_symbols: List[GeneTeaSearchTerm]


class ScreenTypeData(BaseModel):
    overview: OverviewData
    model_performance_info: Dict[str, ModelPerformanceInfo]


class PredData(BaseModel):
    __root__: Dict[str, ScreenTypeData]


class PredictabilityData(BaseModel):
    data: PredData
    error_message: Optional[str] = None
