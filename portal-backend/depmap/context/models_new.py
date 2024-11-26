from typing import Dict, List, Optional
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
import pandas as pd
from depmap.cell_line.models_new import DepmapModel, depmap_model_context_association


class SubtypeNode(Model):
    __tablename__ = "subtype_node"

    subtype_code = Column(String, primary_key=True, index=True)
    oncotree_code = Column(String)
    depmap_model_type = Column(String)
    node_name = Column(String, nullable=False)
    node_level = Column(Integer, nullable=False)
    level_0 = Column(String, nullable=False)
    level_1 = Column(String, nullable=True)
    level_2 = Column(String, nullable=True)
    level_3 = Column(String, nullable=True)
    level_4 = Column(String, nullable=True)
    level_5 = Column(String, nullable=True)
    subtype_node_alias = relationship("SubtypeNodeAlias", lazy="dynamic")

    @classmethod
    def get_by_code(cls, code, must=True) -> Optional["SubtypeNode"]:
        q = db.session.query(SubtypeNode).filter(SubtypeNode.subtype_code == code)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_by_code_and_level(
        subtype_code: str, node_level: int
    ) -> Optional[List["SubtypeNode"]]:
        node_level_column = f"level_{node_level}"
        return (
            db.session.query(SubtypeNode)
            .filter(getattr(SubtypeNode, node_level_column) == subtype_code)
            .all()
        )

    @staticmethod
    def get_subtype_tree_query():
        query = (
            db.session.query(SubtypeNode)
            .join(
                SubtypeContext, SubtypeContext.subtype_code == SubtypeNode.subtype_code
            )
            .join(DepmapModel, SubtypeContext.depmap_model)
            .with_entities(
                DepmapModel.model_id,
                SubtypeNode.subtype_code,
                SubtypeNode.level_0,
                SubtypeNode.level_1,
                SubtypeNode.level_2,
                SubtypeNode.level_3,
                SubtypeNode.level_4,
                SubtypeNode.level_5,
                SubtypeNode.node_name,
                SubtypeNode.node_level,
            )
            .order_by(SubtypeNode.node_level)
        )

        return query

    @staticmethod
    def get_model_ids_by_subtype_code_and_node_level(
        subtype_code: str, node_level: int
    ) -> Dict[str, str]:
        node_level_column = f"level_{node_level}"
        query = (
            db.session.query(SubtypeNode)
            .join(
                DepmapModel, DepmapModel.depmap_model_type == SubtypeNode.subtype_code
            )
            .filter(getattr(SubtypeNode, node_level_column) == subtype_code)
            .with_entities(DepmapModel.model_id, DepmapModel.stripped_cell_line_name)
        )

        cell_lines = pd.read_sql(query.statement, query.session.connection())
        cell_lines_dict = dict(
            zip(
                cell_lines["model_id"].values,
                cell_lines["stripped_cell_line_name"].values,
            )
        )
        return cell_lines_dict

    @staticmethod
    def temporary_get_model_ids_by_subtype_code_and_node_level(
        subtype_code: str, node_level: int
    ) -> Dict[str, str]:
        node_level_column = f"level_{node_level}"
        query = (
            db.session.query(SubtypeNode)
            .join(
                DepmapModel, DepmapModel.depmap_model_type == SubtypeNode.subtype_code
            )
            .filter(getattr(SubtypeNode, node_level_column) == subtype_code)
            .with_entities(DepmapModel.model_id, DepmapModel.stripped_cell_line_name)
        )

        cell_lines = pd.read_sql(query.statement, query.session.connection())

        return cell_lines["model_id"].values


class SubtypeNodeAlias(Model):
    """
    Just holds a string.
    """

    __tablename__ = "subtype_node_alias"
    subtype_node_alias_id = Column(Integer, primary_key=True, autoincrement=True)
    alias_name = Column(String, nullable=False, index=True)
    alias_subtype_code = Column(String, nullable=False, index=True)
    subtype_code = Column(
        String, ForeignKey("subtype_node.subtype_code"), nullable=False
    )
    subtype_node = relationship(
        "SubtypeNode",
        foreign_keys="SubtypeNodeAlias.subtype_code",
        uselist=False,
        overlaps="subtype_node_alias",
    )


class SubtypeContext(Model):
    __tablename__ = "subtype_context"
    subtype_code = Column(String, primary_key=True)
    depmap_model = relationship(
        "DepmapModel", secondary=depmap_model_context_association, backref=__tablename__
    )  # m2m

    @staticmethod
    def get_all_codes():
        return [
            x[0]
            for x in SubtypeContext.query.with_entities(
                SubtypeContext.subtype_code
            ).all()
        ]

    @classmethod
    def get_by_code(cls, name, must=True) -> Optional["SubtypeContext"]:
        q = db.session.query(SubtypeContext).filter(SubtypeContext.subtype_code == name)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    def get_cell_line_names(self) -> List["str"]:
        cell_lines = [cell_line.cell_line_name for cell_line in self.depmap_model]
        return cell_lines

    def get_model_ids(self) -> List["str"]:
        cell_lines = [cell_line.model_id for cell_line in self.depmap_model]
        return cell_lines


class SubtypeContextEntity(Entity):
    entity_id = Column(Integer, ForeignKey("entity.entity_id"), primary_key=True)

    subtype_code = Column(
        String, ForeignKey("subtype_context.subtype_code"), nullable=False
    )
    subtype_context = relationship(
        "SubtypeContext",
        foreign_keys="SubtypeContextEntity.subtype_code",
        uselist=False,
    )

    __mapper_args__ = {"polymorphic_identity": "subtype_context"}

    @staticmethod
    def get_by_label(label, must=True):
        q = db.session.query(SubtypeContextEntity).filter(
            SubtypeContextEntity.label == label
        )
        if must:
            return q.one()
        else:
            return q.one_or_none()
