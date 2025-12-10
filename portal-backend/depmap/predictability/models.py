from json import loads as json_loads
from json import dumps as json_dumps
from typing import List, Optional

import pandas as pd
from flask import url_for, current_app

from depmap import data_access
from depmap.interactive import interactive_utils
from depmap.compound.models import Compound
from depmap.database import (
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
    db,
    relationship,
)
from depmap.dataset.models import (
    BiomarkerDataset,
    DependencyDataset,
    DATASET_NAME_TO_FEATURE_TYPE,
)
from depmap.entity.models import Entity
from depmap.gene.models import Gene
from depmap.compound.models import CompoundExperiment
from depmap.match_related.models import RelatedEntityIndex
from depmap.cell_line.models import Lineage


class TDPredictiveModel(Model):
    """Used to store table of Models which is shown in the TD app. Done as a temporary 20Q2 solution because the TD App and
    the rest of the site use different models"""

    __tablename__ = "td_predictive_model"

    predictive_model_id = Column(Integer, primary_key=True, autoincrement=True)

    dataset_label = Column(String(), nullable=False)

    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), nullable=False, index=True
    )
    entity = relationship(
        "Entity", foreign_keys="TDPredictiveModel.entity_id", uselist=False
    )

    label = Column(String(), nullable=False)
    pearson = Column(Float, nullable=False)

    top_feature_label = Column(String(), nullable=False)
    top_feature_type = Column(String(), nullable=False)


class PredictiveModel(Model):
    """Abstract class of Datasets"""

    __tablename__ = "predictive_model"

    predictive_model_id = Column(Integer, primary_key=True, autoincrement=True)

    dataset_id = Column(
        Integer, ForeignKey("dataset.dataset_id"), nullable=False, index=True
    )
    dataset: DependencyDataset = relationship(
        "Dataset", foreign_keys="PredictiveModel.dataset_id", uselist=False
    )

    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), nullable=False, index=True
    )
    entity: Entity = relationship(
        "Entity", foreign_keys="PredictiveModel.entity_id", uselist=False
    )

    label = Column(String(), nullable=False)
    pearson = Column(
        Float, nullable=False
    )  # if renaming this, please also change column name in PredictiveBackground

    feature_results: List["PredictiveFeatureResult"] = relationship(
        "PredictiveFeatureResult"
    )

    @staticmethod
    def get_top_models_features(
        dataset_id: int, entity_id: int, num_models=3, num_top_features=5
    ):
        """
        :return: America's next top model
        Returns a df with the num_models top PredictiveModel(s) with the highest pearson values
            or, None if there is no model for the specified entity in the specified dataset
        """
        assert num_top_features <= 10  # we have 10 features per model

        subquery = (
            db.session.query(PredictiveModel.predictive_model_id)
            .filter_by(dataset_id=dataset_id, entity_id=entity_id)
            .order_by(PredictiveModel.pearson.desc())
            .limit(num_models)
        )

        q = PredictiveFeatureResult.query.join(PredictiveModel).filter(
            PredictiveModel.dataset_id == dataset_id,
            PredictiveModel.entity_id == entity_id,
            PredictiveModel.predictive_model_id.in_(subquery),
            PredictiveFeatureResult.rank < num_top_features,
        )
        feature_results: List[PredictiveFeatureResult] = q.all()
        if len(feature_results) == 0:
            return None

        rows = []
        for feature_result in feature_results:
            predictive_model = feature_result.predictive_model
            feature = feature_result.feature
            model_label = predictive_model.label

            # Hack to rename these without needing to change pipeline/db
            if model_label == "Core_omics":
                model_label = "Core Omics"
            elif model_label == "DNA_based":
                model_label = "DNA-based"

            row = {
                "predictive_model_id": predictive_model.predictive_model_id,
                "model_label": predictive_model.label,
                "model_pearson": predictive_model.pearson,
                "dataset_enum": predictive_model.dataset.name,
                "feature_name": feature.feature_name,
                "feature_type": feature.feature_type,
                "feature_importance": feature_result.importance,
                "feature_rank": feature_result.rank,
                "interactive_url": None,
                "correlation": None,
                "related_type": False,
            }
            if feature is not None:
                row["interactive_url"] = feature.get_interactive_url_for_entity(
                    predictive_model.dataset, predictive_model.entity,
                )
                row["correlation"] = feature.get_correlation_for_entity(
                    predictive_model.dataset, predictive_model.entity,
                )
                row["related_type"] = feature.get_relation_to_entity(entity_id)
            rows.append(row)

        df = pd.DataFrame(rows)
        return df

    @staticmethod
    def get_top_model(dataset_id, entity_id, must=True) -> Optional["PredictiveModel"]:
        q = (
            PredictiveModel.query.join(DependencyDataset)
            .filter(
                PredictiveModel.dataset_id == dataset_id,
                PredictiveModel.entity_id == entity_id,
            )
            .order_by(PredictiveModel.pearson.desc())
            .limit(1)
        )
        if must:
            return q.one()
        return q.one_or_none()

    @staticmethod
    def get_all_models(dataset_id: int, entity_id: int) -> List["PredictiveModel"]:
        models = PredictiveModel.query.filter_by(
            dataset_id=dataset_id, entity_id=entity_id
        ).all()
        return models

    @staticmethod
    def get_datasets_with_models_for_entity(entity_id: int) -> List[DependencyDataset]:
        dataset_ids = (
            PredictiveModel.query.with_entities(PredictiveModel.dataset_id)
            .filter(PredictiveModel.entity_id == entity_id)
            .distinct()
            .all()
        )

        return [
            DependencyDataset.get_dataset_by_id(dataset_id)
            for (dataset_id,) in dataset_ids
        ]


class PredictiveFeature(Model):
    __tablename__ = "predictive_feature"
    # IDs outputted by tda-ensemble pipeline
    feature_id = Column(String, primary_key=True)

    # Label of the feature in the dataset, or feature_name in the dataset it is from, if we don't have the feature loaded
    feature_name = Column(String, nullable=False)

    # Dataset name (biomarker enum name, "context", or nonstandard dataset id)
    dataset_id = Column(String, nullable=False)

    @classmethod
    def get(cls, feature_id: str, must: bool = True) -> Optional["PredictiveFeature"]:
        query = cls.query.filter_by(feature_id=feature_id)
        if must:
            return query.one()
        return query.one_or_none()

    @property
    def feature_type(self):
        return DATASET_NAME_TO_FEATURE_TYPE.get(self.dataset_id, self.dataset_id)

    def get_interactive_url_for_entity(
        self, dep_dataset: DependencyDataset, entity: Entity
    ) -> Optional[str]:
        """
        Used to generate links from the predictability tab/tile to data explorer.
        DEPRECATED: this does not map to breadbox datasets/data in the way we'd like.
        """
        if not self._get_feature_is_loaded():
            return None
        
        dataset_id = dep_dataset.name.name

        # Special workaround to prevent broken links in data explorer
        # This same dataset exists in breadbox but is indexed by compound, not compound experiment.
        if dataset_id == "Prism_oncology_seq_AUC" and entity.get_entity_type() == "compound_experiment":
            entity = entity.compound
        
        if self.dataset_id == "context":
            return url_for(
                "data_explorer_2.view_data_explorer_2",
                xDataset=dataset_id,
                xFeature=entity.label,
                color1=json_dumps(
                    {
                        "name": self.feature_name,
                        "context_type": "depmap_model",
                        "expr": {
                            "==": [
                                {
                                    "var": f"slice/Context_Matrix/{self.feature_name}/label"
                                },
                                1,
                            ]
                        },
                    }
                ),
            )

        return url_for(
            "data_explorer_2.view_data_explorer_2",
            xDataset=dataset_id,
            xFeature=entity.label,
            yDataset=self.dataset_id,
            yFeature=self.feature_name,
        )

    def get_correlation_for_entity(
        self, dep_dataset: DependencyDataset, entity: Entity
    ) -> Optional[float]:
        if not self._get_feature_is_loaded():
            return None

        dep_dataset_values = data_access.get_row_of_values(
            dep_dataset.name.name, entity.label
        )
        if self.dataset_id == "context":
            cell_lines_in_self_context = data_access.get_row_of_values(
                data_access.get_context_dataset(), self.feature_name
            )
            self_values = pd.Series(
                dep_dataset_values.index.map(
                    lambda depmap_id: depmap_id in cell_lines_in_self_context.index
                ),
                dep_dataset_values.index,
                dtype=int,
            )
        else:
            # For now, this one method call should continue to use the legacy interactive_utils
            # interface for performance reasons. This get_correlation_for_entity method is used 
            # to load data for the predictability tab - and is sometimes called 60+ times in a row 
            # to load data for various features. Breadbox is not currently equipped to handle this 
            # many subsequent requests in a performant way. That's fine because predictability is not 
            # breadbox-friendly at the moment anyway.
            self_values = interactive_utils.get_row_of_values(
                self.dataset_id, self.feature_name
            )
        cor = dep_dataset_values.corr(self_values)
        if pd.isnull(cor):
            return None
        return cor

    def get_relation_to_entity(self, entity_id: int) -> Optional[str]:
        dataset = BiomarkerDataset.get_dataset_by_name(self.dataset_id, must=True)
        if dataset.entity_type != "gene":
            return None

        # Currently relation is only defined for gene-gene or gene-compound. The
        # entity defined by entity_id is the target (either gene or compound
        # experiment), so self_entity must be a gene
        self_entity = Gene.get_by_label(self.feature_name, must=False)
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

    def _get_feature_is_loaded(self) -> bool:
        feature_loaded = BiomarkerDataset.has_entity(
            self.dataset_id, self.feature_name, by_label=True
        )
        return feature_loaded


class PredictiveFeatureResult(Model):
    __tablename__ = "predictive_feature_result"

    predictive_feature_result_id = Column(Integer, primary_key=True, autoincrement=True)

    predictive_model_id = Column(
        Integer, ForeignKey("predictive_model.predictive_model_id"), nullable=False,
    )
    predictive_model: PredictiveModel = relationship(
        "PredictiveModel",
        foreign_keys="PredictiveFeatureResult.predictive_model_id",
        uselist=False,
        overlaps="feature_results",
    )

    feature_id = Column(Integer, ForeignKey("predictive_feature.feature_id"))
    feature: PredictiveFeature = relationship(
        "PredictiveFeature",
        foreign_keys="PredictiveFeatureResult.feature_id",
        uselist=False,
    )

    rank = Column(Integer(), nullable=False)
    importance = Column(Float, nullable=False)


class PredictiveBackground(Model):
    """
    Used for generating the background distribution in the gene page
    """

    __tablename__ = "predictive_background"
    predictive_background_id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("dataset.dataset_id"), unique=True)
    dataset = relationship(
        "Dataset", foreign_keys="PredictiveBackground.dataset_id", uselist=False
    )
    background = Column(String, nullable=False)  # jsonified list of numbers

    @staticmethod
    def get_background(dataset_id):
        background_string = (
            PredictiveBackground.query.filter_by(dataset_id=dataset_id)
            .with_entities(PredictiveBackground.background)
            .one()[0]
        )
        return json_loads(background_string)
