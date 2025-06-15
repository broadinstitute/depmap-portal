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
from depmap.dataset.models import BiomarkerDataset
from depmap.entity.models import Entity
from depmap.gene.models import Gene
from depmap.match_related.models import RelatedEntityIndex
from depmap.entity.models import Entity
from depmap.compound.models import Compound
import pandas as pd
import sqlalchemy
from sqlalchemy import and_
import numpy as np

from depmap.predictability.models import PredictiveModel


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


from typing import Union, Tuple


@dataclass
class PredictiveFeatureSummary:
    feature_name: str
    feature_label: str
    given_id: str
    importance: float
    rank: int
    pearson: float
    dim_type: str
    taiga_id: str


class PrototypePredictiveFeature(Model):
    __tablename__ = "prototype_predictive_feature"
    __table_args__: Union[Dict, Tuple] = (db.Index("idx_ppf_1", "feature_name"),)

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
            .join(
                PrototypePredictiveFeatureResult,
                PrototypePredictiveFeatureResult.feature_id
                == PrototypePredictiveFeature.feature_id,
            )
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
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

    def get_relation_to_entity(self, entity_id: int) -> Optional[str]:
        if self.dim_type != "gene":
            return None

        # Currently relation is only defined for gene-gene or gene-compound. The
        # entity defined by entity_id is the target (either gene or compound
        # experiment), so self_entity must be a gene
        self_entity = Gene.get_by_label(self.feature_label, must=False)

        if self_entity is None:
            return None

        if entity_id == self_entity.entity_id:
            return "self"

        entity = Entity.get_by_entity_id(entity_id)

        if entity.type == "gene":
            related_entity_index = RelatedEntityIndex.get(entity_id)
            if related_entity_index is None:
                return None

            related_entity_ids = related_entity_index.get_related_entity_ids()

            if self_entity.entity_id in related_entity_ids:
                return "related"
        elif entity.type == "compound_experiment":
            compound: Compound = entity.compound
            if any(
                gene.entity_id == self_entity.entity_id for gene in compound.target_gene
            ):
                return "target"
        return None


class PrototypePredictiveModel(Model):
    __tablename__ = "prototype_predictive_model"

    __table_args__: Union[Dict, Tuple] = (
        db.UniqueConstraint(
            "label", "screen_type", "entity_id", name="uc_comp_key_pred_model"
        ),
    )

    predictive_model_id = Column(Integer, primary_key=True, autoincrement=True)

    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), nullable=False, index=True
    )
    entity: Entity = relationship(
        "Entity", foreign_keys="PrototypePredictiveModel.entity_id", uselist=False
    )

    label = Column(String(), nullable=False)
    screen_type = Column(String(), nullable=False)  # crispr or rnai
    predictions_dataset_taiga_id = Column(String(), nullable=False)
    pearson = Column(Float, nullable=False)

    feature_results: List["PrototypePredictiveFeatureResult"] = relationship(
        "PrototypePredictiveFeatureResult"
    )

    @staticmethod
    def get_by_model_name_and_screen_type_and_entity_id(
        model_name: str, screen_type: str, entity_id: int
    ) -> "PrototypePredictiveModel":

        predictive_model = (
            db.session.query(PrototypePredictiveModel)
            .filter(
                and_(
                    PrototypePredictiveModel.label == model_name,
                    PrototypePredictiveModel.screen_type == screen_type,
                    PrototypePredictiveModel.entity_id == entity_id,
                )
            )
            .one()
        )

        return predictive_model

    @staticmethod
    def get_feature_types_added_per_model(
        model_sequence: List[str], entity_id: int, screen_type: str
    ):
        model_features = {}
        previous_model = None
        for model in model_sequence:
            results = (
                db.session.query(PrototypePredictiveModel)
                .filter(
                    and_(
                        PrototypePredictiveModel.label == model,
                        PrototypePredictiveModel.entity_id == entity_id,
                        PrototypePredictiveModel.screen_type == screen_type,
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
    def get_by_entity_label_and_screen_type(entity_label: str, screen_type: str):

        gene_query = (
            db.session.query(PrototypePredictiveFeatureResult)
            .join(
                PrototypePredictiveModel,
                PrototypePredictiveFeatureResult.predictive_model_id
                == PrototypePredictiveModel.predictive_model_id,
            )
            .join(Entity, PrototypePredictiveModel.entity_id == Entity.entity_id)
            .filter(
                and_(
                    Entity.label == entity_label,
                    PrototypePredictiveModel.screen_type == screen_type,
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
            )
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("entity")
            )
        )

        entity_row = pd.read_sql(gene_query.statement, gene_query.session.connection())

        return entity_row

    @staticmethod
    def get_predictive_model_feature_summaries(
        model_name: str, entity_id: int, screen_type: str
    ) -> List[PredictiveFeatureSummary]:
        query = (
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
                PrototypePredictiveFeatureResult.pearson,
                PrototypePredictiveFeature.dim_type,
                PrototypePredictiveFeature.taiga_id,
            )
        )

        return [PredictiveFeatureSummary(*row) for row in query.all()]

    @classmethod
    def find_by_screen_type(
        cls, screen_type, entity_id
    ) -> List["PrototypePredictiveModel"]:
        predictive_models = (
            db.session.query(PrototypePredictiveModel)
            .filter(
                and_(
                    PrototypePredictiveModel.screen_type == screen_type,
                    PrototypePredictiveModel.entity_id == entity_id,
                )
            )
            .all()
        )

        return predictive_models


class PrototypePredictiveFeatureResult(Model):
    __tablename__ = "prototype_predictive_feature_result"
    __table_args__: Union[Dict, Tuple] = (
        db.Index("idx_ppfr_1", "predictive_model_id"),
        db.Index("idx_ppfr_2", "feature_id"),
    )

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

    rank = Column(Integer, nullable=False)
    importance = Column(Float, nullable=False)
    pearson = Column(Float, nullable=False)

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
