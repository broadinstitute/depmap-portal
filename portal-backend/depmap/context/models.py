from typing import List, Optional

import pandas as pd
import sqlalchemy as sa
from sqlalchemy import or_, and_

from depmap.cell_line.models import (
    CellLine,
    Lineage,
    PrimaryDisease,
    TumorType,
    cell_line_context_association,
)
from depmap.compound.models import Compound, CompoundExperiment
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
from depmap.entity.models import Entity
from depmap.gene.models import Gene


class Context(Model):
    __tablename__ = "context"
    name = Column(String, primary_key=True)
    cell_line = relationship(
        "CellLine", secondary=cell_line_context_association, backref=__tablename__
    )  # m2m

    @staticmethod
    def get_all_names():
        return [x[0] for x in Context.query.with_entities(Context.name).all()]

    @classmethod
    def get_by_name(cls, name, must=True) -> Optional["Context"]:
        q = db.session.query(Context).filter(Context.name == name)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    def get_cell_line_names(self) -> List["str"]:
        cell_lines = [cell_line.cell_line_name for cell_line in self.cell_line]
        return cell_lines

    def get_depmap_ids(self) -> List["str"]:
        cell_lines = [cell_line.depmap_id for cell_line in self.cell_line]
        return cell_lines

    @classmethod
    def get_lineage_primary_disease_pairs(cls):
        query = (
            Context.query.join(CellLine, Context.cell_line)
            .join(Lineage, Lineage.name == Context.name)
            .filter(or_(Lineage.level == 1, Lineage.level == 2),)
            .with_entities(CellLine.depmap_id, Lineage.name, Lineage.level)
            .order_by(Lineage.level)
        )

        df = pd.DataFrame(query.all(), columns=["depmap_id", "name", "level"])

        if df.empty:
            return []

        inds = df.columns.difference(["level", "name"]).tolist()
        dummy_value = ""
        df = df.fillna(dummy_value)
        df = df.pivot_table(index=inds, columns="level", values="name", aggfunc="first")
        df["lineage_primary_disease_pair"] = df[[1, 2]].values.tolist()
        df["lineage_primary_disease_pair"] = df["lineage_primary_disease_pair"].apply(
            tuple
        )

        return df["lineage_primary_disease_pair"].unique()

    @classmethod
    def get_cell_line_table_query(cls, name):
        """
        Returns query to display a cell line table, i.e. adding primary disease and primary/metastasis columns
        with_entities is used to say we want a column of cell_line_name
        The 'name' column for PrimaryDisease and TumorType are both called 'name', so add_column is used instead of with_entities to allow renaming with .label
        """
        query = (
            Context.query.filter_by(name=name)
            .join(CellLine, Context.cell_line)
            .outerjoin(PrimaryDisease, TumorType)
            .with_entities(CellLine.depmap_id)
            .add_columns(
                sa.column('"primary_disease".name', is_literal=True).label(
                    "primary_disease"
                ),
                sa.column('"tumor_type".name', is_literal=True).label("tumor_type"),
                sa.column("cell_line_display_name", is_literal=True),
            )
        )
        return query

    @staticmethod
    def get_display_name(name):
        """
        As of writing this, contexts are identical to lineages 
        """
        return Lineage.get_display_name(name)


class ContextEntity(Entity):
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)

    context_name = Column(String, ForeignKey("context.name"), nullable=False)
    context = relationship(
        "Context", foreign_keys="ContextEntity.context_name", uselist=False
    )

    __mapper_args__ = {"polymorphic_identity": "context"}

    @staticmethod
    def get_by_label(label, must=True):
        q = db.session.query(ContextEntity).filter(ContextEntity.label == label)
        if must:
            return q.one()
        else:
            return q.one_or_none()


class ContextEnrichment(Model):
    __table_args__ = (
        db.Index("context_enrichment_idx_1", "entity_id", "dependency_dataset_id"),
        db.UniqueConstraint(
            "context_name",
            "entity_id",
            "dependency_dataset_id",
            name="uc_context_entity_dataset",
        ),
    )

    context_enrichment_id = Column(Integer, primary_key=True, autoincrement=True)

    context_name = Column(
        String, ForeignKey("context.name"), nullable=False, index=True
    )
    context = relationship(
        "Context", foreign_keys="ContextEnrichment.context_name", uselist=False
    )

    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), nullable=False, index=True
    )
    entity = relationship(
        "Entity", foreign_keys="ContextEnrichment.entity_id", uselist=False
    )

    dependency_dataset_id = Column(
        Integer,
        ForeignKey("dependency_dataset.dependency_dataset_id"),
        nullable=False,
        index=True,
    )
    dataset = relationship(
        "DependencyDataset",
        foreign_keys="ContextEnrichment.dependency_dataset_id",
        uselist=False,
    )

    p_value = Column(Float, nullable=False)
    t_statistic = Column(Float, nullable=False)
    effect_size_means_difference = Column(Float, nullable=False)

    # The following 2 class methods are used for the old context page.
    @classmethod
    def get_enriched_context_cell_line_p_value_effect_size(
        cls, entity_id, dataset_id, negative_only=False
    ):
        base_query = cls.query.filter_by(
            entity_id=entity_id, dependency_dataset_id=dataset_id
        )
        if negative_only:
            base_query = base_query.filter(cls.t_statistic < 0)

        context_cell_line_p_value_tuples = (
            base_query.join(Context)
            .join(CellLine, Context.cell_line)
            .with_entities(
                cls.context_name,
                CellLine.depmap_id,
                cls.p_value,
                cls.effect_size_means_difference,
            )
            .all()
        )

        def assert_one_or_none_and_get(series):
            if len(series.index != 0):
                values = series.values.tolist()
                assert len(set(values)) == 1
                return values[0]

        df = pd.DataFrame(
            context_cell_line_p_value_tuples,
            columns=["context", "cell_line", "p_value", "effect_size_means_difference"],
        )
        df = df.groupby("context").aggregate(
            {
                "cell_line": lambda x: set(x),
                "p_value": lambda x: assert_one_or_none_and_get(x),
                "effect_size_means_difference": lambda x: assert_one_or_none_and_get(x),
            }
        )

        return df

    @classmethod
    def get_entities_enriched_in_context_query(cls, context_name):
        from depmap.dataset.models import DependencyDataset  # avoid circular dependency

        q1 = (
            cls.query.filter_by(context_name=context_name)
            .join(DependencyDataset, Gene)
            .with_entities(
                Gene.type.label("type"),
                Gene.label.label("label"),
                Gene.label.label("url_label"),
                DependencyDataset.display_name.label("display_name"),
                ContextEnrichment.t_statistic.label("t_statistic"),
                ContextEnrichment.p_value.label("p_value"),
                ContextEnrichment.effect_size_means_difference.label(
                    "effect_size_means_difference"
                ),
            )
        )

        q2 = (
            cls.query.filter_by(context_name=context_name)
            .join(DependencyDataset, CompoundExperiment)
            .join(Compound, Compound.entity_id == CompoundExperiment.compound_id)
            .with_entities(
                Compound.type.label("type"),
                CompoundExperiment.label,
                Compound.label.label("url_label"),
                DependencyDataset.display_name.label("display_name"),
                ContextEnrichment.t_statistic.label("t_statistic"),
                ContextEnrichment.p_value.label("p_value"),
                ContextEnrichment.effect_size_means_difference.label(
                    "effect_size_means_difference"
                ),
            )
        )
        return q1.union(q2)
