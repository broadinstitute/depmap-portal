from dataclasses import dataclass
import sqlalchemy
from sqlalchemy import and_, func, desc
import enum
from typing import List, Literal, Optional, Tuple
import pandas as pd
from depmap.gene.models import Gene
from depmap.compound.models import CompoundExperiment
from depmap.enums import DependencyEnum
from depmap.context.models_new import SubtypeNode
from depmap.cell_line.models_new import DepmapModel
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


@dataclass
class ContextNameInfo:
    name: str
    subtype_code: str
    node_level: int


def _get_child_lineages_next_lineage_level_from_root_info(
    sorted: pd.DataFrame, current_level: int, current_code: str
) -> Tuple[Optional[List[str]], Optional[int]]:
    next_lineage_level_num = current_level + 1
    next_lineage_level = "level_" + str(next_lineage_level_num)

    children = sorted[
        (sorted[f"level_{current_level}"] == current_code)
        & (sorted["node_level"] == next_lineage_level_num)
    ]

    child_lineages = children[next_lineage_level].unique()

    child_lineages = [child for child in child_lineages if child != ""]

    if len(list(child_lineages)) == 0:
        return None, None

    return child_lineages, next_lineage_level_num


class ContextExplorerTree(dict):
    def __init__(self, root):
        super().__init__()
        self.__dict__ = self
        self.root = root
        self.children = []

    def add_node(self, obj):
        self.children.append(obj)

    def create_context_tree_from_root_info(
        self, tree_df, current_node_code, node_level: int,
    ):
        sorted = tree_df.loc[tree_df[f"level_{node_level}"] == current_node_code]
        (
            child_subtype_codes,
            next_level,
        ) = _get_child_lineages_next_lineage_level_from_root_info(
            sorted=sorted, current_level=node_level, current_code=current_node_code
        )

        if next_level is None:
            return

        if len(child_subtype_codes) > 0:
            for child_subtype_code in child_subtype_codes:
                model_ids_dict = DepmapModel.get_model_ids_by_subtype_code_and_node_level(
                    child_subtype_code, next_level
                )
                model_ids = list(model_ids_dict.keys())

                current_child_codes = [child.subtype_code for child in self.children]
                if len(model_ids) > 0 and child_subtype_code not in current_child_codes:
                    node = ContextNode(
                        name=SubtypeNode.get_by_code(child_subtype_code).node_name,
                        subtype_code=child_subtype_code,
                        parent_subtype_code=current_node_code,
                        model_ids=model_ids,
                        node_level=next_level,
                    )
                    self.add_node(node)

            for child in self.children:
                if child.subtype_code == child_subtype_code:
                    child.create_context_tree_from_root_info(
                        tree_df=sorted,
                        current_node_code=child_subtype_code,
                        node_level=next_level,
                    )

    def get_all_nodes(self):
        for child in self.children:
            if child.get_child_nodes(self) != None:
                child.get_child_nodes(self)
        print(*self.children, sep="\n")
        print("Tree Size:" + str(len(self.children)))


class ContextNode(dict):
    def __init__(
        self, name, subtype_code, parent_subtype_code, node_level, model_ids,
    ):
        super().__init__()
        self.__dict__ = self
        self.name = name  # display name
        self.subtype_code = subtype_code  # unique key
        self.parent_subtype_code = parent_subtype_code
        self.node_level = node_level
        self.model_ids = model_ids
        self.children = []

    def add_node(self, obj):
        self.children.append(obj)

    def get_child_nodes(self, Tree):
        for child in self.children:
            if child.children:
                child.get_child_nodes(Tree)
                Tree.append(child)
            else:
                Tree.append(child)

    def create_context_tree_from_root_info(
        self, tree_df, current_node_code, node_level: int
    ):
        sorted = tree_df.loc[tree_df[f"level_{node_level}"] == current_node_code]
        (
            child_subtype_codes,
            next_level,
        ) = _get_child_lineages_next_lineage_level_from_root_info(
            sorted=sorted, current_level=node_level, current_code=current_node_code
        )

        if next_level is None:
            return

        if len(child_subtype_codes) > 0:
            for child_subtype_code in child_subtype_codes:
                model_ids_dict = DepmapModel.get_model_ids_by_subtype_code_and_node_level(
                    child_subtype_code, next_level
                )
                model_ids = list(model_ids_dict.keys())

                current_child_codes = [child.subtype_code for child in self.children]

                if len(model_ids) > 0 and child_subtype_code not in current_child_codes:
                    node = ContextNode(
                        name=SubtypeNode.get_by_code(child_subtype_code).node_name,
                        subtype_code=child_subtype_code,
                        parent_subtype_code=current_node_code,
                        model_ids=model_ids,
                        node_level=next_level,
                    )
                    self.add_node(node)


# Separated from the class method for testing purposes
def get_context_analysis_query(
    subtype_code: str,
    out_group: str,
    entity_type: Literal["gene", "compound"],
    dataset_name: str,
):
    assert dataset_name in DependencyEnum.values()

    dataset_enum_name = DependencyEnum(dataset_name)
    if entity_type == "gene":
        query = (
            ContextAnalysis.query.filter_by(
                subtype_code=subtype_code,
                out_group=out_group,
                dataset_name=dataset_enum_name,
            )
            .join(Gene, Gene.entity_id == ContextAnalysis.entity_id)
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("entity"),
                sqlalchemy.column('"gene".entrez_id', is_literal=True).label(
                    "entrez_id"
                ),
            )
        )
    else:
        query = (
            ContextAnalysis.query.filter_by(
                subtype_code=subtype_code,
                out_group=out_group,
                dataset_name=dataset_enum_name,
            )
            .join(
                CompoundExperiment,
                CompoundExperiment.entity_id == ContextAnalysis.entity_id,
            )
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("entity")
            )
        )

    return query


class OutGroupType(enum.Enum):
    All = "All"
    Lineage = "Lineage"
    Type = "Type"


class BoxPlotTypes(enum.Enum):
    SelectedLineage = "SelectedLineage"
    SelectedPrimaryDisease = "SelectedPrimaryDisease"
    SameLineage = "SameLineage"
    SameLineageType = "SameLineageType"
    OtherLineageType = "OtherLineageType"
    Other = "Other"


class ContextAnalysis(Model):
    __table_args__ = (
        db.Index("context_analysis_idx_1", "entity_id", "out_group"),
        db.UniqueConstraint(
            "subtype_code", "out_group", "entity_id", name="uc_context_outgroup_entity",
        ),
    )
    context_analysis_id = Column(Integer, primary_key=True, autoincrement=True)
    # context_name = Column(
    #     String, ForeignKey("context.name"), nullable=False, index=True
    # )
    # context = relationship(
    #     "Context", foreign_keys="ContextAnalysis.context_name", uselist=False
    # )
    subtype_code = Column(
        String, ForeignKey("subtype_node.subtype_code"), nullable=False, index=True
    )
    subtype = relationship(
        "SubtypeNode", foreign_keys="ContextAnalysis.subtype_code", uselist=False
    )
    entity_id = Column(
        Integer, ForeignKey("entity.entity_id"), nullable=False, index=True
    )
    entity = relationship(
        "Entity", foreign_keys="ContextAnalysis.entity_id", uselist=False
    )

    dataset_name: "Column[DependencyEnum]" = Column(
        db.Enum(DependencyEnum, name="DependencyEnum"), nullable=False
    )

    out_group = Column(String, nullable=False)
    t_pval = Column(Float)
    mean_in = Column(Float)
    mean_out = Column(Float)
    effect_size = Column(Float)
    t_qval = Column(Float)
    t_qval_log = Column(Float)

    # TODO: The columns n_dep_in, n_dep_out, frac_dep_in, frac_dep_out all depend on a binarized version of the data, which only
    # makes sense for genes. So these columns will be the same for the gene page, but will be entirely NaNs for drug entities.
    # The thought is that those columns should be dropped from the displayed version of the table for the two drug tabs
    n_dep_in = Column(Float)
    n_dep_out = Column(Float)
    frac_dep_in = Column(Float)
    frac_dep_out = Column(Float)
    # TODO: selectivity_val is a different metric between gene and drug pages, so we'll also need to pick different colorscales to use.
    selectivity_val = Column(Float)

    def to_dict(self):
        entity_label = self.entity.label
        if self.entity.type == "gene":
            gene = Gene.get_by_id(self.entity_id)
            if gene.entrez_id:
                entity_label = f"{entity_label} ({gene.entrez_id})"

        return {
            "entity": entity_label,
            "subtype_code": self.subtype_code,
            "dataset_name": self.dataset_name,
            "out_group": self.out_group,
            "t_pval": self.t_pval,
            "mean_in": self.mean_in,
            "mean_out": self.mean_out,
            "effect_size": self.effect_size,
            "t_qval": self.t_qval,
            "t_qval_log": self.t_qval_log,
            "n_dep_in": self.n_dep_in,
            "n_dep_out": self.n_dep_out,
            "frac_dep_in": self.frac_dep_in,
            "frac_dep_out": self.frac_dep_out,
            "selectivity_val": self.selectivity_val,
        }

    @staticmethod
    def find_context_analysis_by_subtype_code_out_group(
        subtype_code: str,
        out_group: str,
        entity_type: Literal["gene", "compound"],
        dataset_name: str,
    ):
        query = get_context_analysis_query(
            subtype_code=subtype_code,
            out_group=out_group,
            entity_type=entity_type,
            dataset_name=dataset_name,
        )
        context_analysis_df = pd.read_sql(query.statement, query.session.connection())

        return context_analysis_df

    @staticmethod
    def get_other_context_dependencies(
        subtype_code: str,
        out_group: str,
        entity_id: int,
        entity_type: Literal["gene", "compound"],
        fdr: List[float],
        abs_effect_size: List[float],
        frac_dep_in: List[float],
    ):
        if entity_type == "gene":
            return (
                ContextAnalysis.query.filter(
                    and_(
                        ContextAnalysis.subtype_code != subtype_code,
                        ContextAnalysis.out_group == out_group,
                        ContextAnalysis.entity_id == entity_id,
                        ContextAnalysis.t_qval >= fdr[0],
                        ContextAnalysis.t_qval <= fdr[1],
                        func.abs(ContextAnalysis.effect_size) >= abs_effect_size[0],
                        func.abs(ContextAnalysis.effect_size) <= abs_effect_size[1],
                        ContextAnalysis.frac_dep_in >= frac_dep_in[0],
                        ContextAnalysis.frac_dep_in <= frac_dep_in[1],
                    )
                )
                .join(Gene, Gene.entity_id == ContextAnalysis.entity_id)
                .join(
                    SubtypeNode,
                    SubtypeNode.subtype_code == ContextAnalysis.subtype_code,
                )
                # Need the node name AND code, because node_names are not always unique, but codes are
                .with_entities(SubtypeNode.node_name, SubtypeNode.subtype_code,)
                .order_by(desc(ContextAnalysis.mean_in))
                .all()
            )
        else:
            return (
                ContextAnalysis.query.filter(
                    and_(
                        ContextAnalysis.subtype_code != subtype_code,
                        ContextAnalysis.out_group == out_group,
                        ContextAnalysis.entity_id == entity_id,
                        ContextAnalysis.t_qval >= fdr[0],
                        ContextAnalysis.t_qval <= fdr[1],
                        func.abs(ContextAnalysis.effect_size) >= abs_effect_size[0],
                        func.abs(ContextAnalysis.effect_size) <= abs_effect_size[1],
                    )
                )
                .join(
                    CompoundExperiment,
                    CompoundExperiment.entity_id == ContextAnalysis.entity_id,
                )
                .join(
                    SubtypeNode,
                    SubtypeNode.subtype_code == ContextAnalysis.subtype_code,
                )
                # Need the node name AND code, because node_names are not always unique, but codes are
                .with_entities(SubtypeNode.node_name, SubtypeNode.subtype_code,)
                .order_by(desc(ContextAnalysis.mean_in))
                .all()
            )


class ContextExplorerGlobalSearch(Model):
    __tablename__ = "context_explorer"
    context_id = Column(Integer, primary_key=True, autoincrement=True)
    lineage_name = Column(String)
    primary_disease_name = Column(String)

    def __init__(self, lineage_name, primary_disease_name):
        self.lineage_name = lineage_name
        self.primary_disease_name = primary_disease_name
