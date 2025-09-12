from dataclasses import dataclass
from operator import and_
from typing import Dict, List, Optional, Set, Tuple
from depmap.database import (
    Column,
    ForeignKey,
    Integer,
    Model,
    String,
    db,
    relationship,
)

import enum
import pandas as pd
from typing import Type
from sqlalchemy import and_, or_
from depmap.entity.models import Entity
from depmap.cell_line.models_new import DepmapModel, depmap_model_context_association


@dataclass
class OtherModelDisplayNames:
    heme: Dict[str, str]
    solid: Dict[str, str]


class TreeType(enum.Enum):
    Lineage = "Lineage"
    MolecularSubtype = "MolecularSubtype"


class SubtypeNode(Model):
    __tablename__ = "subtype_node"

    subtype_code = Column(String, primary_key=True, index=True)
    oncotree_code = Column(String)
    depmap_model_type = Column(String)
    molecular_subtype_code = Column(String)
    tree_type = Column(String, nullable=False)
    node_name = Column(String, nullable=False)
    node_level = Column(Integer, nullable=False)
    level_0 = Column(String, nullable=False)
    level_1 = Column(String, nullable=True)
    level_2 = Column(String, nullable=True)
    level_3 = Column(String, nullable=True)
    level_4 = Column(String, nullable=True)
    level_5 = Column(String, nullable=True)

    @classmethod
    def get_by_code(cls, code, must=True) -> Optional["SubtypeNode"]:
        q = db.session.query(SubtypeNode).filter(SubtypeNode.subtype_code == code)
        if must:
            return q.one()
        else:
            return q.one_or_none()

    @staticmethod
    def get_display_name(subtype_code: str, must=True) -> Optional[str]:
        q = db.session.query(SubtypeNode).filter(
            SubtypeNode.subtype_code == subtype_code
        )
        if must:
            node = q.one()
            return node.node_name
        else:
            node = q.one_or_none()
            if node is None:
                return node
            else:
                return node.node_name

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
    def get_next_level_nodes_using_current_level_code(
        code, level
    ) -> List["SubtypeNode"]:
        node_level_column = f"level_{level}"

        results = (
            db.session.query(SubtypeNode)
            .join(
                SubtypeContext, SubtypeContext.subtype_code == SubtypeNode.subtype_code
            )
            .filter(
                and_(
                    getattr(SubtypeNode, node_level_column) == code,
                    SubtypeNode.node_level == level + 1,
                )
            )
            .all()
        )

        return results

    @staticmethod
    def get_by_tree_type_and_level(tree_type, level) -> List["SubtypeNode"]:
        results = (
            db.session.query(SubtypeNode)
            # Join with SubtypeContext to filter out nodes with 0 depmap models.
            .join(
                SubtypeContext, SubtypeContext.subtype_code == SubtypeNode.subtype_code
            )
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
    def get_all_by_models_query(tree_type: str):
        query = (
            db.session.query(SubtypeContext)
            .join(SubtypeNode, SubtypeNode.subtype_code == SubtypeContext.subtype_code)
            .filter(SubtypeNode.tree_type == tree_type)
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
    ) -> List[str]:
        context = SubtypeContext.get_by_code(subtype_code)
        model_ids = SubtypeContext.get_model_ids_by_node_level(context, node_level)

        return model_ids


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

    # Only used for Context Explorer box plots
    @staticmethod
    def get_model_ids_for_node_branch(
        subtype_codes: List[str], level_0_subtype_code: str
    ) -> Tuple[Optional[Dict[str, List[str]]], Optional[List[str]]]:

        only_get_nodes_on_this_branch_filters = and_(
            SubtypeNode.level_0 == level_0_subtype_code,
            or_(
                SubtypeNode.level_1 == None,
                SubtypeNode.level_1.in_(subtype_codes),
                SubtypeNode.level_2.in_(subtype_codes),
                SubtypeNode.level_3.in_(subtype_codes),
                SubtypeNode.level_4.in_(subtype_codes),
                SubtypeNode.level_5.in_(subtype_codes),
            ),
        )

        filters = only_get_nodes_on_this_branch_filters

        nodes = db.session.query(SubtypeNode).filter(filters).all()

        if len(nodes) == 0:
            return None, []

        node_models = {}
        all_model_ids = []

        for node in nodes:
            level_0 = SubtypeContext.get_by_code(node.level_0, must=False)
            assert level_0 is not None
            model_ids = [model.model_id for model in level_0.depmap_model]
            if len(model_ids) > 0:
                node_models[level_0.subtype_code] = model_ids
                all_model_ids.extend(model_ids)

            if node.level_1:
                level_1 = SubtypeContext.get_by_code(node.level_1, must=False)

                if level_1:
                    model_ids = [model.model_id for model in level_1.depmap_model]
                    if len(model_ids) > 0:
                        node_models[level_1.subtype_code] = model_ids
                        all_model_ids.extend(model_ids)

            if node.level_2:
                level_2 = SubtypeContext.get_by_code(node.level_2, must=False)

                if level_2:
                    model_ids = [model.model_id for model in level_2.depmap_model]
                    if len(model_ids) > 0:
                        node_models[level_2.subtype_code] = model_ids
                        all_model_ids.extend(model_ids)

            if node.level_3:
                level_3 = SubtypeContext.get_by_code(node.level_3, must=False)

                if level_3:
                    model_ids = [model.model_id for model in level_3.depmap_model]
                    if len(model_ids) > 0:
                        node_models[level_3.subtype_code] = model_ids
                        all_model_ids.extend(model_ids)

            if node.level_4:
                level_4 = SubtypeContext.get_by_code(node.level_4, must=False)

                if level_4:
                    model_ids = [model.model_id for model in level_4.depmap_model]
                    if len(model_ids) > 0:
                        node_models[level_4.subtype_code] = model_ids
                        all_model_ids.extend(model_ids)

            if node.level_5:
                level_5 = SubtypeContext.get_by_code(node.level_5, must=False)

                if level_5:
                    model_ids = [model.model_id for model in level_5.depmap_model]
                    if len(model_ids) > 0:
                        node_models[level_5.subtype_code] = model_ids
                        all_model_ids.extend(model_ids)

        return node_models, all_model_ids

    @staticmethod
    def get_model_ids_for_other_heme_and_other_solid_contexts(
        subtype_codes_to_filter_out: Set[str], tree_type: str, all_sig_models: Set[str],
    ) -> OtherModelDisplayNames:
        HEME_filter_exp = and_(
            or_(SubtypeNode.level_0 == "MYELOID", SubtypeNode.level_0 == "LYMPH"),
            SubtypeNode.tree_type == tree_type,
        )

        SOLID_filter_exp = and_(
            SubtypeNode.level_0 != "MYELOID",
            SubtypeNode.level_0 != "LYMPH",
            SubtypeNode.tree_type == tree_type,
        )

        # We are looking for insignificant models only, so filter out significant subtype codes and models
        depmap_model_context_query = (
            db.session.query(depmap_model_context_association)
            .filter(
                (
                    depmap_model_context_association.c.subtype_code.notin_(
                        subtype_codes_to_filter_out
                    )
                )
                & (depmap_model_context_association.c.model_id.notin_(all_sig_models))
            )
            .join(
                SubtypeNode,
                SubtypeNode.subtype_code
                == depmap_model_context_association.c.subtype_code,
            )
        )

        other_heme_model_contexts = depmap_model_context_query.filter(
            HEME_filter_exp
        ).all()
        other_solid_model_contexts = depmap_model_context_query.filter(
            SOLID_filter_exp
        ).all()

        heme_display_name_series = {}
        if len(other_heme_model_contexts) != 0:
            heme_model_ids = [c[0] for c in other_heme_model_contexts]

            if len(heme_model_ids) > 0:
                heme_display_names = DepmapModel.get_cell_line_display_names(
                    model_ids=list(set(heme_model_ids))
                )
                heme_display_name_series = heme_display_names.to_dict()

        solid_display_name_series = {}
        if len(other_solid_model_contexts) != 0:
            solid_model_ids = [c[0] for c in other_solid_model_contexts]

            if len(solid_model_ids) > 0:
                solid_display_names = DepmapModel.get_cell_line_display_names(
                    model_ids=list(set(solid_model_ids))
                )
                solid_display_name_series = solid_display_names.to_dict()

        return OtherModelDisplayNames(
            heme=heme_display_name_series, solid=solid_display_name_series
        )

    @staticmethod
    def get_model_ids_for_other_heme_contexts(
        subtype_codes_to_filter_out: List[str],
        tree_type: str,
        all_sig_models: List[str],
    ) -> Dict[str, str]:
        # Nodes with "MYELOID" or "LYMPHOID" at level 0 are considered "Heme contexts".
        # We want to find the insignficant heme contexts, leaving out branches that
        # have a signficant leaf node. Hence, the filter: SubtypeNode.level_0.notin_(subtype_codes_to_filter_out).
        # For example, if a Myeloid subtype is selected, and Lymph is signficant, we should not
        # get any "other heme" contexts from this query.
        subtype_codes_to_filter_out_set = set(subtype_codes_to_filter_out)
        all_sig_models_set = set(all_sig_models)
        depmap_model_contexts = (
            db.session.query(depmap_model_context_association)
            .filter(
                (
                    depmap_model_context_association.c.subtype_code.notin_(
                        subtype_codes_to_filter_out_set
                    )
                )
                & (
                    depmap_model_context_association.c.model_id.notin_(
                        all_sig_models_set
                    )
                )
            )
            .join(
                SubtypeNode,
                SubtypeNode.subtype_code
                == depmap_model_context_association.c.subtype_code,
            )
            .filter(
                and_(
                    or_(
                        SubtypeNode.level_0 == "MYELOID", SubtypeNode.level_0 == "LYMPH"
                    ),
                    SubtypeNode.tree_type == tree_type,
                )
            )
            .all()
        )

        if len(depmap_model_contexts) == 0:
            return {}

        model_ids = [c[0] for c in depmap_model_contexts]

        if len(model_ids) == 0:
            return {}

        display_name_series = DepmapModel.get_cell_line_display_names(
            model_ids=list(set(model_ids))
        )
        return display_name_series.to_dict()

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

    @staticmethod
    def get_model_context_tree_levels(tree_type, model_id: str):
        model_context_nodes = (
            db.session.query(SubtypeContext)
            .join(SubtypeNode, SubtypeNode.subtype_code == SubtypeContext.subtype_code)
            .filter(SubtypeNode.tree_type == tree_type)
            .join(DepmapModel, SubtypeContext.depmap_model)
            .filter(DepmapModel.model_id == model_id)
            .with_entities(
                SubtypeNode.subtype_code,
                SubtypeNode.level_0,
                SubtypeNode.level_1,
                SubtypeNode.level_2,
                SubtypeNode.level_3,
                SubtypeNode.level_4,
                SubtypeNode.level_5,
                SubtypeNode.node_level,
                SubtypeNode.node_name,
            )
        )

        df = pd.DataFrame(model_context_nodes)

        return df


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


# for global search support.
class SubtypeContextGlobalSearch(Model):
    __tablename__ = "subtype_context_search"
    subtype_context_search_id = Column(Integer, primary_key=True, autoincrement=True)
    subtype_context_code = Column(String)
    subtype_node_name = Column(String)

    def __init__(self, subtype_context_code, subtype_node_name):
        self.subtype_context_code = subtype_context_code
        self.subtype_node_name = subtype_node_name
