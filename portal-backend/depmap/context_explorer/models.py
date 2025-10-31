from dataclasses import dataclass
import json
from depmap import data_access
from depmap.cell_line.models_new import DepmapModel
from depmap.entity.models import Entity
import sqlalchemy
from sqlalchemy import and_, or_, func, desc
import enum
from typing import Any, Dict, List, Literal, Optional, Tuple, Union
import pandas as pd
from depmap.gene.models import Gene
from depmap.compound.models import Compound
from depmap.enums import DependencyEnum
from depmap.dataset.models import DependencyDataset
from depmap.context.models_new import SubtypeContext, SubtypeNode
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


class ContextExplorerDatasets(enum.Enum):
    Rep_all_single_pt = "Rep_all_single_pt"
    Prism_oncology_AUC_collapsed = "Prism_oncology_AUC_collapsed"
    Chronos_Combined = "Chronos_Combined"

    @staticmethod
    def values():
        return {x.value for x in ContextExplorerDatasets}


@dataclass
class ContextPathInfo:
    path: List[str]
    tree_type: Literal["Lineage", "MolecularSubtype"]


@dataclass
class BoxData:
    label: str
    data: List[float]
    cell_line_display_names: List[str]
    path: Optional[List[str]] = None


@dataclass
class GroupedOtherBoxPlotData:
    heme: BoxData
    solid: BoxData


@dataclass
class BoxCardData:
    significant: List[BoxData]
    insignificant: BoxData
    level_0_code: str


@dataclass
class ContextPlotBoxData:
    significant_selection: Union[List[BoxData], None]
    insignificant_selection: Union[BoxData, None]
    other_cards: List[BoxCardData]
    insignificant_heme_data: BoxData
    insignificant_solid_data: BoxData
    drug_dotted_line: Any
    feature_label: str
    feature_overview_page_label: str
    dataset_units: str


@dataclass
class NodeEntityData:
    feature_id: int
    label: str
    feature_full_row_of_values: pd.Series
    feature_overview_page_label: str


@dataclass
class ContextNameInfo:
    name: str
    subtype_code: str
    node_level: int


@dataclass
class EnrichedLineagesTileData:
    box_plot_data: ContextPlotBoxData
    top_context_name_info: Union[ContextNameInfo, None]
    selected_context_name_info: Union[ContextNameInfo, None]
    dataset_name: str
    dataset_display_name: str
    context_explorer_url: str


def _get_child_lineages_next_lineage_level_from_root_info(
    sorted: pd.DataFrame, current_level: int, current_code: str
) -> Tuple[Optional[List[str]], Optional[int]]:
    next_lineage_level_num = current_level + 1
    next_lineage_level = "level_" + str(next_lineage_level_num)

    if next_lineage_level not in sorted:
        return None, None

    children = sorted[
        (sorted[f"level_{current_level}"] == current_code)
        & (sorted["node_level"] == next_lineage_level_num)
    ]

    child_lineages = children[next_lineage_level].unique()

    child_lineages = [child for child in child_lineages if child != ""]

    if len(list(child_lineages)) == 0:
        return None, None

    return child_lineages, next_lineage_level_num


class ContextNode(dict):
    def __init__(
        self, name, subtype_code, parent_subtype_code, node_level, model_ids, path=[],
    ):
        super().__init__()
        self.__dict__ = self
        self.name = name  # display name
        self.subtype_code = subtype_code  # unique key
        self.parent_subtype_code = parent_subtype_code
        self.node_level = node_level
        self.model_ids = model_ids
        self.path = path
        self.children = []

    def add_node(self, obj):
        self.children.append(obj)

    def find_path_to_context_node(self, target_subtype_code: str, path: List[str] = []):
        path = path + [self.subtype_code] if self.subtype_code not in path else path

        if self.subtype_code == target_subtype_code:
            return path

        path = path + [target_subtype_code]

        return path

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
                model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
                    child_subtype_code, next_level
                )
                current_child_codes = [child.subtype_code for child in self.children]

                if len(model_ids) > 0 and child_subtype_code not in current_child_codes:
                    subtype_node = SubtypeNode.get_by_code(child_subtype_code)
                    assert subtype_node is not None
                    node = ContextNode(
                        name=subtype_node.node_name,
                        subtype_code=child_subtype_code,
                        parent_subtype_code=current_node_code,
                        model_ids=model_ids,
                        node_level=next_level,
                        path=self.find_path_to_context_node(
                            child_subtype_code, self.path
                        ),
                    )
                    self.add_node(node)

            for child in self.children:
                child.create_context_tree_from_root_info(
                    tree_df=sorted,
                    current_node_code=child.subtype_code,
                    node_level=next_level,
                )


# Separated from the class method for testing purposes
def get_context_analysis_query(
    subtype_code: str,
    out_group: str,
    feature_type: Literal["gene", "compound"],
    dataset_given_id: str,
):
    assert dataset_given_id in ContextExplorerDatasets.values()

    if feature_type == "gene":
        query = (
            ContextAnalysis.query.filter_by(
                subtype_code=subtype_code,
                out_group=out_group,
                dataset_given_id=dataset_given_id,
            )
            .join(Gene, Gene.entrez_id == ContextAnalysis.feature_id)
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("feature"),
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
                dataset_given_id=dataset_given_id,
            )
            .join(Compound, Compound.compound_id == ContextAnalysis.feature_id)
            .add_columns(
                sqlalchemy.column('"entity".label', is_literal=True).label("entity")
            )
        )

    return query


class BoxPlotTypes(enum.Enum):
    SelectedLineage = "SelectedLineage"
    Other = "Other"


class ContextAnalysis(Model):
    __table_args__ = (
        db.Index("context_analysis_idx_1", "feature_id", "out_group"),
        db.UniqueConstraint(
            "subtype_code",
            "out_group",
            "feature_id",
            name="uc_context_outgroup_entity",
        ),
    )
    context_analysis_id = Column(Integer, primary_key=True, autoincrement=True)

    subtype_code = Column(
        String, ForeignKey("subtype_context.subtype_code"), nullable=False, index=True
    )
    subtype_context = relationship(
        "SubtypeContext", foreign_keys="ContextAnalysis.subtype_code", uselist=False
    )
    # A gene's entrez_id or a compound_id
    feature_id = Column(String, nullable=False, index=True)

    dataset_given_id = Column(String, nullable=False)

    out_group = Column(String, nullable=False)
    t_pval = Column(Float)
    mean_in = Column(Float)
    mean_out = Column(Float)
    effect_size = Column(Float)
    t_qval = Column(Float)
    t_qval_log = Column(Float)
    n_dep_in = Column(Float)
    n_dep_out = Column(Float)
    frac_dep_in = Column(Float)
    frac_dep_out = Column(Float)
    selectivity_val = Column(Float)

    def to_dict(self):
        feature_labels_by_id = data_access.get_dataset_feature_labels_by_id(
            self.dataset_given_id
        )
        feature_label = feature_labels_by_id.get(self.feature_id, self.feature_id)

        return {
            "feature": feature_label,
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

    @property
    def dataset_name(self):
        return data_access.get_dataset_label(self.dataset_given_id)

    @staticmethod
    def get_enriched_context_cell_line_p_value_effect_size(
        feature_id, dataset_id, feature_type, negative_only=True
    ):
        def _get_compound_min_effect_size_by_dependency_dataset_name():

            if dataset_id == ContextExplorerDatasets.Prism_oncology_AUC_collapsed:
                return 0.1
            else:
                return 0.5

        base_query = (
            ContextAnalysis.query.filter(
                and_(
                    ContextAnalysis.feature_id == feature_id,
                    ContextAnalysis.dataset_given_id == dataset_id,
                    ContextAnalysis.out_group == "All Others",
                    ContextAnalysis.t_qval <= 0.05,
                    ContextAnalysis.frac_dep_in >= 0.1,
                    func.abs(ContextAnalysis.effect_size) >= 0.25,
                )
            )
            if feature_type == "gene"
            else ContextAnalysis.query.filter(
                and_(
                    ContextAnalysis.feature_id == feature_id,
                    ContextAnalysis.dataset_given_id == dataset_id,
                    ContextAnalysis.out_group == "All Others",
                    ContextAnalysis.t_qval <= 0.05,
                    func.abs(ContextAnalysis.effect_size)
                    >= _get_compound_min_effect_size_by_dependency_dataset_name(),
                )
            )
        )

        if negative_only:
            base_query = base_query.filter(ContextAnalysis.effect_size < 0)

        context_cell_line_p_value_tuples = (
            base_query.join(
                SubtypeNode, SubtypeNode.subtype_code == ContextAnalysis.subtype_code
            )
            .filter(SubtypeNode.tree_type == "Lineage")
            .join(SubtypeContext)
            .join(DepmapModel, SubtypeContext.depmap_model)
            .with_entities(
                ContextAnalysis.subtype_code,
                DepmapModel.model_id,
                ContextAnalysis.t_qval,
                ContextAnalysis.effect_size,
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
            columns=["context", "cell_line", "q_value", "effect_size"],
        )

        df = df.groupby("context").aggregate(
            {
                "cell_line": lambda x: set(x),
                "q_value": lambda x: assert_one_or_none_and_get(x),
                "effect_size": lambda x: assert_one_or_none_and_get(x),
            }
        )

        return df

    @staticmethod
    def find_context_analysis_by_subtype_code_out_group(
        subtype_code: str,
        out_group: str,
        feature_type: Literal["gene", "compound"],
        dataset_given_id: str,
    ):
        query = get_context_analysis_query(
            subtype_code=subtype_code,
            out_group=out_group,
            feature_type=feature_type,
            dataset_given_id=dataset_given_id,
        )
        context_analysis_df = pd.read_sql(query.statement, query.session.connection())

        return context_analysis_df

    @staticmethod
    def get_context_dependencies(
        tree_type: str,
        feature_id: int,
        dataset_given_id: str,
        feature_type: str,
        max_fdr: float,
        min_abs_effect_size: float,
        min_frac_dep_in: float,
        show_positive_effect_sizes: bool,
        out_group: str = "All Others",
    ):
        assert dataset_given_id in ContextExplorerDatasets.values()

        if feature_type == "gene":
            filters = (
                and_(
                    ContextAnalysis.out_group == out_group,
                    ContextAnalysis.dataset_given_id == dataset_given_id,
                    ContextAnalysis.feature_id == feature_id,
                    ContextAnalysis.t_qval <= max_fdr,
                    func.abs(ContextAnalysis.effect_size) >= min_abs_effect_size,
                    ContextAnalysis.frac_dep_in >= min_frac_dep_in,
                )
                if show_positive_effect_sizes
                else and_(
                    ContextAnalysis.out_group == out_group,
                    ContextAnalysis.dataset_given_id == dataset_given_id,
                    ContextAnalysis.feature_id == feature_id,
                    ContextAnalysis.t_qval <= max_fdr,
                    ContextAnalysis.effect_size < 0,
                    func.abs(ContextAnalysis.effect_size) >= min_abs_effect_size,
                    ContextAnalysis.frac_dep_in >= min_frac_dep_in,
                )
            )

            analyses = (
                ContextAnalysis.query.filter(filters)
                .join(
                    SubtypeContext,
                    SubtypeContext.subtype_code == ContextAnalysis.subtype_code,
                )
                .join(
                    SubtypeNode,
                    SubtypeNode.subtype_code == SubtypeContext.subtype_code,
                )
                .filter(SubtypeNode.tree_type == tree_type)
                # frontend will be organized into cards based on level 0, so we need to make sure we know
                # the level 0 of each subtype_code returned
                .with_entities(SubtypeNode.level_0, SubtypeNode.subtype_code)
                .order_by(desc(ContextAnalysis.mean_in))
                .all()
            )

            return pd.DataFrame(analyses)
        else:
            filters = (
                and_(
                    ContextAnalysis.out_group == out_group,
                    ContextAnalysis.dataset_given_id == dataset_given_id,
                    ContextAnalysis.feature_id == feature_id,
                    ContextAnalysis.t_qval <= max_fdr,
                    func.abs(ContextAnalysis.effect_size) >= min_abs_effect_size,
                )
                if show_positive_effect_sizes
                else and_(
                    ContextAnalysis.out_group == out_group,
                    ContextAnalysis.dataset_given_id == dataset_given_id,
                    ContextAnalysis.feature_id == feature_id,
                    ContextAnalysis.t_qval <= max_fdr,
                    func.abs(ContextAnalysis.effect_size) >= min_abs_effect_size,
                    ContextAnalysis.effect_size < 0,
                )
            )
            analyses = (
                ContextAnalysis.query.filter(filters)
                .join(
                    SubtypeContext,
                    SubtypeContext.subtype_code == ContextAnalysis.subtype_code,
                )
                .join(
                    SubtypeNode,
                    SubtypeNode.subtype_code == SubtypeContext.subtype_code,
                )
                .filter(SubtypeNode.tree_type == tree_type)
                .with_entities(SubtypeNode.level_0, SubtypeNode.subtype_code)
                .order_by(desc(ContextAnalysis.mean_in))
                .all()
            )

            return pd.DataFrame(analyses)
