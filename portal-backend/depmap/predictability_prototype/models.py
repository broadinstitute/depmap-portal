from typing import List, Optional
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
from depmap.compound.models import Compound
from depmap.dataset.models import (
    BiomarkerDataset,
    DependencyDataset,
    DATASET_NAME_TO_FEATURE_TYPE,
)
from depmap.match_related.models import RelatedEntityIndex
from depmap.entity.models import Entity
from depmap.gene.models import Gene
import pandas as pd
import sqlalchemy
from sqlalchemy import and_, or_
import numpy as np


# @dataclass
# class


class PrototypePredictiveFeature(Model):
    __tablename__ = "prototype_predictive_feature"

    feature_id = Column(Integer, primary_key=True, autoincrement=True)

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
        cls, feature_label: str, must: bool = True
    ) -> Optional["PrototypePredictiveFeature"]:
        query = cls.query.filter_by(feature_label=feature_label)
        if must:
            return query.one()
        return query.one_or_none()

    @staticmethod
    def get_by_feature_label(feature_label: str):
        result = (
            db.session.query(PrototypePredictiveFeature)
            .filter(PrototypePredictiveFeature.feature_label == feature_label,)
            .all()
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
    pearson = Column(Float, nullable=False)

    feature_results: List["PrototypePredictiveFeatureResult"] = relationship(
        "PrototypePredictiveFeatureResult"
    )

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
    def get_entity_row(model_name: str, entity_label: str):

        gene_query = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
            .filter(PrototypePredictiveModel.label == model_name)
            .join(Entity, PrototypePredictiveModel.entity_id == Entity.entity_id)
            .filter(Entity.label == entity_label)
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

    feature_id = Column(Integer, ForeignKey("prototype_predictive_feature.feature_id"))
    feature: PrototypePredictiveFeature = relationship(
        "PrototypePredictiveFeature",
        foreign_keys="PrototypePredictiveFeatureResult.feature_id",
        uselist=False,
    )

    rank = Column(Integer(), nullable=False)
    importance = Column(Float, nullable=False)

    @staticmethod
    def get_taiga_id_from_full_feature_name(model_name: str, feature_name: str):
        result = (
            db.session.query(PrototypePredictiveFeatureResult)
            .filter(
                and_(
                    PrototypePredictiveModel.label == model_name,
                    PrototypePredictiveFeature.feature_name == feature_name,
                )
            )
            .with_entities(
                PrototypePredictiveFeature.taiga_id,
                PrototypePredictiveFeature.given_id,
            )
            .one()
        )

        taiga_id = result[0]
        feature_given_id = result[1]
        return taiga_id, feature_given_id

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