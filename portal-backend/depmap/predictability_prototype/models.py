from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from depmap import data_access
from depmap.database import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
    db,
    relationship,
)
from depmap.entity.models import Entity
import pandas as pd
import sqlalchemy
from sqlalchemy import and_
import numpy as np


@dataclass
class TopFeaturesBarData:
    data: Dict[str, Any]
    x_axis_label: str
    y_axis_label: str


@dataclass
class ModelPredData:
    predictions: List[float]
    actuals: List[float]


@dataclass
class ModelPredictionsGraphData:
    model_pred_data: ModelPredData
    predictions_dataset_id: str
    cell_lines: str
    x_label: str
    y_label: str
    model: str
    density: Any


@dataclass
class CorrData:
    corr_heatmap_vals: List[List[float]]
    row_labels: List[str]
    gene_symbol_feature_types: Dict[str, str]
    feature_names: List[str]
    feature_types: List[str]


@dataclass
class PredictiveModelData:
    model_predictions: ModelPredictionsGraphData
    corr: CorrData


class PrototypePredictiveFeature(Model):
    __tablename__ = "prototype_predictive_feature"

    feature_id = Column(String, primary_key=True)

    # Label of the feature in the dataset, or feature_name in the dataset it is from, if we don't have the feature loaded
    feature_name = Column(String, nullable=False)
    feature_label = Column(String, nullable=False)
    dim_type = Column(String)
    taiga_id = Column(String)
    given_id = Column(String)

    # Dataset name (biomarker enum name, "context", or nonstandard dataset id)
    # dataset_id = Column(String, nullable=False)

    @classmethod
    def get(
        cls, feature_name: str, must: bool = True
    ) -> Optional["PrototypePredictiveFeature"]:
        query = cls.query.filter_by(feature_name=feature_name)
        if must:
            return query.one()
        return query.one_or_none()

    @staticmethod
    def get_taiga_id_from_feature_name(
        model_name: str, feature_name: str, screen_type: str
    ):
        result = (
            db.session.query(PrototypePredictiveFeature)
            .filter(
                and_(
                    PrototypePredictiveModel.label == model_name,
                    PrototypePredictiveModel.screen_type == screen_type,
                    PrototypePredictiveFeature.feature_name == feature_name,
                )
            )
            .one()
        )

        return result.taiga_id, result.given_id

    @staticmethod
    def get_by_feature_name(feature_name: str):
        result = (
            db.session.query(PrototypePredictiveFeature)
            .filter(PrototypePredictiveFeature.feature_name == feature_name)
            .one_or_none()
        )

        return result

    @staticmethod
    def get_by_feature_label(feature_label: str):
        result = (
            db.session.query(PrototypePredictiveFeature)
            .filter(PrototypePredictiveFeature.feature_label == feature_label)
            .one_or_none()
        )

        return result


class PrototypePredictiveModel(Model):
    __tablename__ = "prototype_predictive_model"
    predictive_model_id = Column(Integer, primary_key=True, autoincrement=True)

    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), nullable=False, index=True
    )
    entity: Entity = relationship(
        "Entity", foreign_keys="PrototypePredictiveModel.entity_id", uselist=False
    )

    label = Column(String(), nullable=False)
    screen_type = Column(String(), nullable=False)  # crispr or rnai
    pearson = Column(Float, nullable=False)

    feature_results: List["PrototypePredictiveFeatureResult"] = relationship(
        "PrototypePredictiveFeatureResult"
    )

    # TODO: Figure out how to compute the model sequence
    # @staticmethod
    # def get_model_sequence(entity_label: str, screen_type: str = "crispr"):
    #     # For each unique model label
    #     # For an individual entity
    #     # What is the model name, and how many PredictiveFeatureResults are there
    #     # Order these ascending to get the model sequence
    #     query = (
    #         db.session.query(PrototypePredictiveFeatureResult)
    #         .join(
    #             PrototypePredictiveModel,
    #             PrototypePredictiveFeatureResult.predictive_model_id
    #             == PrototypePredictiveModel.predictive_model_id,
    #         )
    #         .filter(PrototypePredictiveModel.screen_type == screen_type)
    #         .join(
    #             PrototypePredictiveFeature,
    #             PrototypePredictiveFeatureResult.feature_id
    #             == PrototypePredictiveFeature.feature_id,
    #         )
    #         .join(Entity, PrototypePredictiveModel.entity_id == Entity.entity_id)
    #         .filter(Entity.label == entity_label)
    #         .with_entities(
    #             PrototypePredictiveModel.label, PrototypePredictiveFeature.feature_name
    #         )
    #     )

    #     # all_models = [model for model, in all_models_query_result]
    #     model_df = pd.read_sql(query.statement, query.session.connection())

    @staticmethod
    def get_by_model_name(model_name: str):
        query = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
            .filter(PrototypePredictiveModel.label == model_name)
            .join(Entity, PrototypePredictiveModel.entity_id == Entity.entity_id)
            .join(
                PrototypePredictiveFeature,
                PrototypePredictiveFeatureResult.feature_id
                == PrototypePredictiveFeature.feature_id,
            )
            .with_entities(
                PrototypePredictiveFeature.feature_label,
                PrototypePredictiveFeature.given_id,
                PrototypePredictiveFeatureResult.importance,
                PrototypePredictiveFeatureResult.rank,
                PrototypePredictiveFeature.dim_type,
                PrototypePredictiveModel.pearson,
            )
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("entity")
            )
        )
        model_df = pd.read_sql(query.statement, query.session.connection())

        return model_df

    @staticmethod
    def get_feature_types_added_per_model(model_sequence: List[str], entity_id: int):
        model_features = {}
        previous_model = None
        for model in model_sequence:
            results = (
                db.session.query(PrototypePredictiveModel)
                .filter(
                    and_(
                        PrototypePredictiveModel.label == model,
                        PrototypePredictiveModel.entity_id == entity_id,
                    )
                )
                .join(
                    PrototypePredictiveFeatureResult,
                    PrototypePredictiveFeatureResult.predictive_model_id
                    == PrototypePredictiveModel.predictive_model_id,
                )
                .join(
                    PrototypePredictiveFeature,
                    PrototypePredictiveFeatureResult.feature_id
                    == PrototypePredictiveFeature.feature_id,
                )
                .with_entities(PrototypePredictiveFeature.dim_type)
                .distinct()
                .all()
            )
            feature_given_ids = [r for r, in results]

            if previous_model != None:
                model_features[model] = set(feature_given_ids) - set(
                    model_features[previous_model]
                )
            else:
                model_features[model] = set(feature_given_ids)

            previous_model = model

        return model_features

    @staticmethod
    def get_features_added_per_model(model_sequence: List[str], entity_id: int):
        model_features = {}
        previous_model = None
        for model in model_sequence:
            results = (
                db.session.query(PrototypePredictiveModel)
                .filter(
                    and_(
                        PrototypePredictiveModel.label == model,
                        PrototypePredictiveModel.entity_id == entity_id,
                    )
                )
                .join(
                    PrototypePredictiveFeatureResult,
                    PrototypePredictiveFeatureResult.predictive_model_id
                    == PrototypePredictiveModel.predictive_model_id,
                )
                .join(
                    PrototypePredictiveFeature,
                    PrototypePredictiveFeatureResult.feature_id
                    == PrototypePredictiveFeature.feature_id,
                )
                .with_entities(PrototypePredictiveFeature.feature_label)
                .distinct()
                .all()
            )
            feature_given_ids = [r for r, in results]

            if previous_model != None:
                model_features[model] = set(feature_given_ids) - set(
                    model_features[previous_model]
                )
            else:
                model_features[model] = set(feature_given_ids)

            previous_model = model

        return model_features

    @staticmethod
    def get_by_entity_label(entity_label: str):

        gene_query = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
            .join(Entity, PrototypePredictiveModel.entity_id == Entity.entity_id)
            .filter(Entity.label == entity_label)
            .join(
                PrototypePredictiveFeature,
                PrototypePredictiveFeatureResult.feature_id
                == PrototypePredictiveFeature.feature_id,
            )
            .with_entities(
                PrototypePredictiveFeature.feature_name,
                PrototypePredictiveFeature.feature_label,
                PrototypePredictiveFeature.given_id,
                PrototypePredictiveFeatureResult.importance,
                PrototypePredictiveFeatureResult.rank,
                PrototypePredictiveFeature.dim_type,
                PrototypePredictiveModel.pearson,
            )
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("entity")
            )
        )

        entity_row = pd.read_sql(gene_query.statement, gene_query.session.connection())

        return entity_row

    @staticmethod
    def get_entity_row(model_name: str, entity_id: int, screen_type: str):

        gene_query = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
            .filter(
                and_(
                    PrototypePredictiveModel.label == model_name,
                    PrototypePredictiveModel.screen_type == screen_type,
                    PrototypePredictiveModel.entity_id == entity_id,
                )
            )
            .join(
                PrototypePredictiveFeature,
                PrototypePredictiveFeatureResult.feature_id
                == PrototypePredictiveFeature.feature_id,
            )
            .with_entities(
                PrototypePredictiveFeature.feature_name,
                PrototypePredictiveFeature.feature_label,
                PrototypePredictiveFeature.given_id,
                PrototypePredictiveFeatureResult.importance,
                PrototypePredictiveFeatureResult.rank,
                PrototypePredictiveFeature.dim_type,
                PrototypePredictiveModel.pearson,
                PrototypePredictiveFeature.taiga_id,
            )
        )

        entity_row = pd.read_sql(gene_query.statement, gene_query.session.connection())

        return entity_row

    @staticmethod
    def get_r_squared_for_model(model_name):
        result = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(PrototypePredictiveModel)
            .filter(PrototypePredictiveModel.label == model_name)
            .with_entities(PrototypePredictiveModel.pearson)
            .all()
        )

        # TODO make sure this is the correct way to get r_squared!!!!!
        pearson_vals = [r for r, in result]
        avg_pearson_val = np.mean(pearson_vals)

        r_squared = avg_pearson_val * avg_pearson_val

        return r_squared


class PrototypePredictiveFeatureResult(Model):
    __tablename__ = "prototype_predictive_feature_result"

    predictive_feature_result_id = Column(Integer, primary_key=True, autoincrement=True)

    predictive_model_id = Column(
        Integer,
        ForeignKey("prototype_predictive_model.predictive_model_id"),
        nullable=False,
    )
    predictive_model: PrototypePredictiveModel = relationship(
        "PrototypePredictiveModel",
        foreign_keys="PrototypePredictiveFeatureResult.predictive_model_id",
        uselist=False,
        overlaps="feature_results",
    )

    feature_id = Column(String, ForeignKey("prototype_predictive_feature.feature_id"))
    feature: PrototypePredictiveFeature = relationship(
        "PrototypePredictiveFeature",
        foreign_keys="PrototypePredictiveFeatureResult.feature_id",
        uselist=False,
        cascade="delete",
    )
    screen_type = Column(String, nullable=False)  # crispr or rnai

    rank = Column(Integer, nullable=False)
    importance = Column(Float, nullable=False)

    @staticmethod
    def get_feature_result(
        model_name: str, entity_label: str, screen_type: str, feature_name: str
    ):

        gene_query = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
            .filter(
                and_(
                    PrototypePredictiveModel.label == model_name,
                    PrototypePredictiveModel.screen_type == screen_type,
                )
            )
            .join(Entity, PrototypePredictiveModel.entity_id == Entity.entity_id)
            .filter(Entity.label == entity_label)
            .join(
                PrototypePredictiveFeature,
                PrototypePredictiveFeatureResult.feature_id
                == PrototypePredictiveFeature.feature_id,
            )
            .filter(PrototypePredictiveFeature.feature_name == feature_name)
            .with_entities(
                PrototypePredictiveFeature.feature_name,
                PrototypePredictiveFeature.feature_label,
                PrototypePredictiveFeature.given_id,
                PrototypePredictiveFeature.dim_type,
            )
        )

        result = pd.read_sql(gene_query.statement, gene_query.session.connection())

        return result

    @staticmethod
    def get_all_label_name_features_for_model(model_name: str):
        result = (
            db.session.query(PrototypePredictiveFeature)
            .filter(and_(PrototypePredictiveModel.label == model_name))
            .with_entities(
                PrototypePredictiveFeature.feature_label,
                PrototypePredictiveFeature.feature_name,
                PrototypePredictiveModel.label,
            )
            .all()
        )

        return result
