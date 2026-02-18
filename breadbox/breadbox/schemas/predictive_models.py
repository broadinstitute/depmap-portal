from pydantic import BaseModel, Field
from typing import List, Optional


class IDAndName(BaseModel):
    """Dataset id/name pair"""

    id: str
    name: str


class ModelConfigIn(BaseModel):
    """Input for a single model config"""

    model_config_name: str
    model_config_description: str


class ModelConfigOut(BaseModel):
    """Output for a single model config"""

    id: str
    model_config_name: str
    model_config_description: str


class PredictiveModelConfigIn(BaseModel):
    """Input for creating/updating configs for a dimension type"""

    configs: List[ModelConfigIn]


class PredictiveModelConfigOut(BaseModel):
    """Output for configs for a dimension type"""

    dimension_type_name: str
    configs: List[ModelConfigOut]


class PredictiveFeature(BaseModel):
    """Top feature info for a predictive model"""

    rank: int
    feature_dataset_id: str
    feature_given_id: str
    feature_label: Optional[str] = Field(
        default=None, json_schema_extra={"nullable": True}
    )
    importance: float
    correlation_with_actual: float


class ModelFit(BaseModel):
    """Single model result with top features"""

    predictions_dataset: IDAndName
    config_name: str
    config_description: str
    prediction_actual_correlation: float
    top_features: List[PredictiveFeature]


class PredictiveModelsResponse(BaseModel):
    """Response for feature query"""

    actuals_dataset: IDAndName
    actuals_feature_given_id: str
    actuals_feature_label: str
    model_fits: List[ModelFit]


class BulkLoadResultsIn(BaseModel):
    """Input for bulk load of results"""

    file_ids: List[str]
    md5: str
    predictions_dataset_id: str
