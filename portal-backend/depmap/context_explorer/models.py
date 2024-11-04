from dataclasses import dataclass
import sqlalchemy
from sqlalchemy import and_, func, desc
import enum
from typing import List, Literal, Optional, Tuple
from depmap.cell_line.models import Lineage
import pandas as pd
from depmap.gene.models import Gene
from depmap.compound.models import CompoundExperiment
from depmap.enums import DependencyEnum
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
    display_name: str


def _get_child_lineages_next_lineage_level_from_root_info(
    sorted: pd.DataFrame, current_level: str,
) -> Tuple[Optional[List[str]], Optional[str]]:
    next_lineage_level_num = int(current_level) + 1
    next_lineage_level = "lineage_" + str(next_lineage_level_num)

    if next_lineage_level not in sorted:
        return None, None

    child_lineages = sorted[next_lineage_level].unique()

    return child_lineages, next_lineage_level


class ContextExplorerTree(dict):
    def __init__(self, root):
        super().__init__()
        self.__dict__ = self
        self.root = root
        self.children = []

    def add_node(self, obj):
        self.children.append(obj)

    def create_context_tree_from_root_info(
        self,
        tree_df,
        current_lineage,
        lineage_df,
        current_lineage_level: str,  # e.g.: "lineage_2"
        has_gene_dep_data,
        has_drug_data,
        crispr_depmap_ids,
        drug_depmap_ids,
    ):
        _, current_level = current_lineage_level.split("_")
        sorted = tree_df.loc[tree_df[current_lineage_level] == current_lineage]

        (
            child_lineages,
            next_lineage_level,
        ) = _get_child_lineages_next_lineage_level_from_root_info(
            sorted=sorted, current_level=current_level,
        )
        if next_lineage_level is None:
            return

        _, next_level = next_lineage_level.split("_")

        if len(child_lineages) > 0:
            for child_lineage in child_lineages:
                lineage_row = lineage_df.loc[
                    lineage_df.index == (child_lineage, int(next_level))
                ]

                depmap_ids = (
                    list(set(lineage_row["depmap_id"].values.tolist()[0]))
                    if len(lineage_row["depmap_id"]) != 0
                    else []
                )

                current_child_names = [child.name for child in self.children]
                if len(depmap_ids) > 0 and child_lineage not in current_child_names:
                    node = ContextNode(
                        name=child_lineage,
                        depmap_ids=depmap_ids,
                        has_gene_dep_data=has_gene_dep_data,
                        has_drug_data=has_drug_data,
                        crispr_depmap_ids=crispr_depmap_ids,
                        drug_depmap_ids=drug_depmap_ids,
                    )
                    self.add_node(node)

            for child in self.children:
                child.create_context_tree_from_root_info(
                    tree_df=sorted,
                    current_lineage=child_lineage,
                    lineage_df=lineage_df,
                    current_lineage_level=next_lineage_level,
                    has_gene_dep_data=child.has_gene_dep_data,
                    has_drug_data=child.has_drug_data,
                    crispr_depmap_ids=crispr_depmap_ids,
                    drug_depmap_ids=drug_depmap_ids,
                )

    def get_all_nodes(self):
        for child in self.children:
            if child.get_child_nodes(self) != None:
                child.get_child_nodes(self)
        print(*self.children, sep="\n")
        print("Tree Size:" + str(len(self.children)))


class ContextNode(dict):
    def __init__(
        self,
        name,
        depmap_ids,
        has_gene_dep_data,
        has_drug_data,
        crispr_depmap_ids,
        drug_depmap_ids,
    ):
        super().__init__()
        self.__dict__ = self
        self.name = name
        self.display_name = Lineage.get_display_name(self.name)
        self.depmap_ids = depmap_ids
        self.has_gene_dep_data = has_gene_dep_data(crispr_depmap_ids, depmap_ids)
        self.has_drug_data = has_drug_data(drug_depmap_ids, depmap_ids)
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
        self,
        tree_df,
        current_lineage,
        lineage_df,
        current_lineage_level: str,  # e.g.: "lineage_2"
        has_gene_dep_data,
        has_drug_data,
        crispr_depmap_ids,
        drug_depmap_ids,
    ):
        _, current_level = current_lineage_level.split("_")
        sorted = tree_df.loc[tree_df[current_lineage_level] == current_lineage]
        (
            child_lineages,
            next_lineage_level,
        ) = _get_child_lineages_next_lineage_level_from_root_info(
            sorted=sorted, current_level=current_level,
        )

        if next_lineage_level is None:
            return

        _, next_level = next_lineage_level.split("_")

        if len(child_lineages) > 0:
            for child_lineage in child_lineages:
                lineage_row = lineage_df.loc[
                    lineage_df.index == (child_lineage, int(next_level))
                ]
                depmap_ids = (
                    list(set(lineage_row["depmap_id"].iloc[[0]].values[0]))
                    if len(lineage_row["depmap_id"]) != 0
                    else []
                )

                current_child_names = [child.name for child in self.children]
                if len(depmap_ids) > 0 and child_lineage not in current_child_names:
                    node = ContextNode(
                        name=child_lineage,
                        depmap_ids=depmap_ids,
                        has_gene_dep_data=has_gene_dep_data,
                        has_drug_data=has_drug_data,
                        crispr_depmap_ids=crispr_depmap_ids,
                        drug_depmap_ids=drug_depmap_ids,
                    )
                    self.add_node(node)


# Separated from the class method for testing purposes
def get_context_analysis_query(
    context_name: str,
    out_group: str,
    entity_type: Literal["gene", "compound"],
    dataset_name: str,
):
    assert dataset_name in DependencyEnum.values()

    dataset_enum_name = DependencyEnum(dataset_name)
    if entity_type == "gene":
        query = (
            ContextAnalysis.query.filter_by(
                context_name=context_name,
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
                context_name=context_name,
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
            "context_name", "out_group", "entity_id", name="uc_context_outgroup_entity",
        ),
    )
    context_analysis_id = Column(Integer, primary_key=True, autoincrement=True)
    context_name = Column(
        String, ForeignKey("context.name"), nullable=False, index=True
    )
    context = relationship(
        "Context", foreign_keys="ContextAnalysis.context_name", uselist=False
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
            "context_name": self.context_name,
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
    def find_context_analysis_by_context_name_out_group(
        context_name: str,
        out_group: str,
        entity_type: Literal["gene", "compound"],
        dataset_name: str,
    ):
        query = get_context_analysis_query(
            context_name=context_name,
            out_group=out_group,
            entity_type=entity_type,
            dataset_name=dataset_name,
        )
        context_analysis_df = pd.read_sql(query.statement, query.session.connection())

        return context_analysis_df

    @staticmethod
    def get_other_context_dependencies(
        context_name: str,
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
                        ContextAnalysis.context_name != context_name,
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
                .with_entities(ContextAnalysis.context_name)
                .order_by(desc(ContextAnalysis.mean_in))
                .all()
            )
        else:
            return (
                ContextAnalysis.query.filter(
                    and_(
                        ContextAnalysis.context_name != context_name,
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
                .with_entities(ContextAnalysis.context_name)
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
