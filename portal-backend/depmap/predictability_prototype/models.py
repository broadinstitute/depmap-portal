from dataclasses import dataclass
from operator import or_
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
from depmap.gene.models import Gene
import pandas as pd
import sqlalchemy
from sqlalchemy import and_, or_
import numpy as np


# @dataclass
# class


class PredictabilitySummary(Model):
    __table_args__ = (db.Index("predictability_summary_idx_1", "entity_id"),)
    predictability_summary_id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(
        Integer, ForeignKey("gene.entity_id"), nullable=False, index=True
    )
    gene = relationship(
        "Gene", foreign_keys="PredictabilitySummary.entity_id", uselist=False
    )
    model = Column(String)
    pearson = Column(Float)
    feature0 = Column(String)
    feature0_importance = Column(Float)
    feature1 = Column(String)
    feature1_importance = Column(Float)
    feature2 = Column(String)
    feature2_importance = Column(Float)
    feature3 = Column(String)
    feature3_importance = Column(Float)
    feature4 = Column(String)
    feature4_importance = Column(Float)
    feature5 = Column(String)
    feature5_importance = Column(Float)
    feature6 = Column(String)
    feature6_importance = Column(Float)
    feature7 = Column(String)
    feature7_importance = Column(Float)
    feature8 = Column(String)
    feature8_importance = Column(Float)
    feature9 = Column(String)
    feature9_importance = Column(Float)

    @staticmethod
    def get_by_model_name(model_name: str):
        query = (
            db.session.query(PredictabilitySummary)
            .filter(PredictabilitySummary.model == model_name)
            .join(Gene, PredictabilitySummary.entity_id == Gene.entity_id)
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("gene")
            )
        )

        model_df = pd.read_sql(query.statement, query.session.connection())

        return model_df

    @staticmethod
    def get_gene_row(model_name: str, gene_symbol: str):
        gene_query = (
            db.session.query(PredictabilitySummary)
            .filter(PredictabilitySummary.model == model_name)
            .join(Gene, PredictabilitySummary.entity_id == Gene.entity_id)
            .filter(Gene.label == gene_symbol)
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("gene")
            )
        )

        gene_row = pd.read_sql(gene_query.statement, gene_query.session.connection())

        return gene_row

    @staticmethod
    def get_features(model_name: str, gene_symbol: str):
        gene_query = (
            db.session.query(PredictabilitySummary)
            .filter(PredictabilitySummary.model == model_name)
            .join(Gene, PredictabilitySummary.entity_id == Gene.entity_id)
            .filter(Gene.label == gene_symbol)
            .with_entities(
                PredictabilitySummary.feature0,
                PredictabilitySummary.feature1,
                PredictabilitySummary.feature2,
                PredictabilitySummary.feature3,
                PredictabilitySummary.feature4,
                PredictabilitySummary.feature5,
                PredictabilitySummary.feature6,
                PredictabilitySummary.feature7,
                PredictabilitySummary.feature8,
                PredictabilitySummary.feature9,
            )
        )

        features = pd.read_sql(gene_query.statement, gene_query.session.connection())

        return features.values.tolist()[0]

    @staticmethod
    def get_r_squared_for_model(model_name):
        result = (
            db.session.query(PredictabilitySummary)
            .filter(PredictabilitySummary.model == model_name)
            .with_entities(PredictabilitySummary.pearson)
            .all()
        )

        # TODO make sure this is the correct way to get r_squared!!!!!
        pearson_vals = [r for r, in result]
        avg_pearson_val = np.mean(pearson_vals)

        r_squared = avg_pearson_val * avg_pearson_val

        return r_squared


class PredictiveInsightsFeature(Model):
    predictive_insights_feature_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    model = Column(String, nullable=False)
    feature_name = Column(String, nullable=False)
    feature_label = Column(String, nullable=False)
    dim_type = Column(String)
    taiga_id = Column(String)
    given_id = Column(String)

    @staticmethod
    def get_taiga_id_from_full_feature_name(model_name: str, feature_name: str):
        result = (
            db.session.query(PredictiveInsightsFeature)
            .filter(
                and_(
                    PredictiveInsightsFeature.model == model_name,
                    PredictiveInsightsFeature.feature_name == feature_name,
                )
            )
            .with_entities(
                PredictiveInsightsFeature.taiga_id, PredictiveInsightsFeature.given_id,
            )
            .one()
        )

        taiga_id = result[0]
        feature_given_id = result[1]
        return taiga_id, feature_given_id

    @staticmethod
    def get_all_label_name_features_for_model(model_name: str):
        result = (
            db.session.query(PredictiveInsightsFeature)
            .filter(and_(PredictiveInsightsFeature.model == model_name))
            .with_entities(
                PredictiveInsightsFeature.feature_label,
                PredictiveInsightsFeature.feature_name,
                PredictiveInsightsFeature.model,
            )
            .all()
        )

        return result
