from operator import and_
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
import enum
import sqlalchemy
from sqlalchemy import and_, or_
from depmap.entity.models import Entity
import pandas as pd
from depmap.cell_line.models_new import DepmapModel, depmap_model_context_association


class TreeType(enum.Enum):
    Lineage = "Lineage"
    MolecularSubtype = "MolecularSubtype"


class SubtypeNode(Model):
    __tablename__ = "subtype_node"

    subtype_code = Column(String, primary_key=True, index=True)
    oncotree_code = Column(String)
    depmap_model_type = Column(String)
    molecular_subtype_code = Column(String)
    tree_type: "Column[TreeType]" = Column(
        db.Enum(TreeType, name="TreeType"), nullable=False
    )
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
    def get_all_organized_descending_by_level():
        return db.session.query(SubtypeNode).order_by(SubtypeNode.node_level.desc())

    @staticmethod
    def get_children_using_current_level_code(code, level) -> List["SubtypeNode"]:
        node_level_column = f"level_{level}"

        results = (
            db.session.query(SubtypeNode)
            .filter(
                and_(
                    getattr(SubtypeNode, node_level_column) == code,
                    SubtypeNode.node_level > level,
                )
            )
            .all()
        )

        return results

    @staticmethod
    def get_by_tree_type_and_level(tree_type, level) -> List["SubtypeNode"]:
        results = (
            db.session.query(SubtypeNode)
            .filter(
                and_(
                    SubtypeNode.tree_type == tree_type, SubtypeNode.node_level == level
                )
            )
            .all()
        )

        return results

    @staticmethod
    def get_subtype_tree_by_models_query(tree_type, level_0_subtype_code: str):
        query = (
            db.session.query(SubtypeContext)
            .join(SubtypeNode, SubtypeNode.subtype_code == SubtypeContext.subtype_code)
            .filter(
                and_(
                    SubtypeNode.tree_type == tree_type,
                    SubtypeNode.level_0 == level_0_subtype_code,
                )
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
        context = SubtypeContext.get_by_code(subtype_code)
        model_ids = SubtypeContext.get_model_ids_by_node_level(context, node_level)

        return model_ids

    @staticmethod
    def temporary_get_model_ids_of_children(
        level_0_subtype_code: str,
    ) -> Dict[str, str]:
        query = (
            db.session.query(SubtypeNode)
            .join(
                DepmapModel, DepmapModel.depmap_model_type == SubtypeNode.subtype_code
            )
            .filter(SubtypeNode.level_0 == level_0_subtype_code)
            .with_entities(DepmapModel.model_id, DepmapModel.stripped_cell_line_name)
        )

        cell_lines = pd.read_sql(query.statement, query.session.connection())

        return cell_lines["model_id"].values

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

    @staticmethod
    def get_cell_line_names(self) -> List["str"]:
        cell_lines = [cell_line.cell_line_name for cell_line in self.depmap_model]
        return cell_lines

    @staticmethod
    def get_model_ids_for_node_branch(
        subtype_codes: List[str],
    ) -> Optional[Dict[str, List[str]]]:
        nodes = (
            db.session.query(SubtypeNode)
            .filter(
                or_(
                    SubtypeNode.level_0.in_(subtype_codes),
                    SubtypeNode.level_1.in_(subtype_codes),
                    SubtypeNode.level_2.in_(subtype_codes),
                    SubtypeNode.level_3.in_(subtype_codes),
                    SubtypeNode.level_4.in_(subtype_codes),
                    SubtypeNode.level_5.in_(subtype_codes),
                )
            )
            .all()
        )

        if len(nodes) == 0:
            return None

        node_models = {}
        for node in nodes:
            level_0 = SubtypeContext.get_by_code(node.level_0, must=False)
            node_models[level_0.subtype_code] = [
                model.model_id for model in level_0.depmap_model
            ]

            if node.level_1:
                level_1 = SubtypeContext.get_by_code(node.level_1, must=False)

                if level_1:
                    node_models[level_1.subtype_code] = [
                        model.model_id for model in level_1.depmap_model
                    ]

            if node.level_2:
                level_2 = SubtypeContext.get_by_code(node.level_2, must=False)

                if level_2:
                    node_models[level_2.subtype_code] = [
                        model.model_id for model in level_2.depmap_model
                    ]

            if node.level_3:
                level_3 = SubtypeContext.get_by_code(node.level_3, must=False)

                if level_3:
                    node_models[level_3.subtype_code] = [
                        model.model_id for model in level_3.depmap_model
                    ]

            if node.level_4:
                level_4 = SubtypeContext.get_by_code(node.level_4, must=False)

                if level_4:
                    node_models[level_4.subtype_code] = [
                        model.model_id for model in level_4.depmap_model
                    ]

            if node.level_5:
                level_5 = SubtypeContext.get_by_code(node.level_5, must=False)

                if level_5:
                    node_models[level_5.subtype_code] = [
                        model.model_id for model in level_5.depmap_model
                    ]

        return node_models

    @staticmethod
    def get_model_ids_for_other_solid_contexts(
        subtype_codes_to_filter_out: List[str],
    ) -> Dict[str, str]:
        contexts = (
            db.session.query(SubtypeContext)
            .filter(SubtypeContext.subtype_code.notin_(subtype_codes_to_filter_out))
            .join(SubtypeNode, SubtypeNode.subtype_code == SubtypeContext.subtype_code)
            .filter(
                and_(SubtypeNode.level_0 != "MYELOID", SubtypeNode.level_0 != "LYMPH")
            )
            .all()
        )

        if len(contexts) == 0:
            return pd.Series()

        model_ids = [
            cell_line.model_id
            for context in contexts
            for cell_line in context.depmap_model
        ]
        display_name_series = DepmapModel.get_cell_line_display_names(
            model_ids=list(set(model_ids))
        )

        return display_name_series

    @staticmethod
    def get_model_ids_for_other_heme_contexts(
        subtype_codes_to_filter_out: List[str],
    ) -> Dict[str, str]:

        contexts = (
            db.session.query(SubtypeContext)
            .filter(SubtypeContext.subtype_code.notin_(subtype_codes_to_filter_out),)
            .join(SubtypeNode, SubtypeNode.subtype_code == SubtypeContext.subtype_code)
            .filter(
                or_(SubtypeNode.level_0 == "MYELOID", SubtypeNode.level_0 == "LYMPH",)
            )
            .all()
        )

        if len(contexts) == 0:
            return pd.Series()

        model_ids = [
            cell_line.model_id
            for context in contexts
            for cell_line in context.depmap_model
        ]
        display_name_series = DepmapModel.get_cell_line_display_names(
            model_ids=list(set(model_ids))
        )

        return display_name_series

    @staticmethod
    def get_model_ids_by_node_level(self, level) -> List["str"]:
        subtype_code = self.subtype_code
        nodes = SubtypeNode.get_children_using_current_level_code(subtype_code, level)
        codes = [node.subtype_code for node in nodes]
        codes.append(subtype_code)

        contexts = (
            db.session.query(SubtypeContext)
            .filter(SubtypeContext.subtype_code.in_(codes))
            .all()
        )

        cell_lines = [
            cell_line.model_id
            for context in contexts
            for cell_line in context.depmap_model
        ]
        return list(set(cell_lines))

    @classmethod
    def get_cell_line_table_query(cls, subtype_code):
        query = (
            SubtypeContext.query.filter_by(subtype_code=subtype_code)
            .join(DepmapModel, SubtypeContext.depmap_model)
            .join(SubtypeNode, SubtypeNode.subtype_code == SubtypeContext.subtype_code)
            .with_entities(
                DepmapModel.model_id, SubtypeNode.level_1.label("primary_disease"),
            )
            .add_columns(
                sqlalchemy.column("primary_or_metastasis", is_literal=True).label(
                    "tumor_type"
                ),
                sqlalchemy.column("stripped_cell_line_name", is_literal=True).label(
                    "cell_line_display_name"
                ),
            )
        )
        return query


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
