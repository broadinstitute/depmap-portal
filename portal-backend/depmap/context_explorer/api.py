from operator import mod
from typing import Dict, List, Literal, Tuple, Union
import os
import re
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound, CompoundExperiment
from depmap.context_explorer.utils import (
    get_box_plot_data_for_primary_disease,
    get_box_plot_data_for_selected_lineage,
    get_other_context_dependencies,
    get_full_row_of_values_and_depmap_ids,
    get_context_dose_curves,
    get_entity_id_from_entity_full_label,
)
from depmap.tda.views import convert_series_to_json_safe_list
from flask_restplus import Namespace, Resource
from flask import current_app, request
import pandas as pd
from depmap.dataset.models import DependencyDataset
from depmap.settings.shared import DATASET_METADATA
from depmap.context_explorer.models import (
    ContextAnalysis,
    ContextNameInfo,
    ContextNode,
    ContextExplorerTree,
)
from depmap.context.models_new import SubtypeNode

from depmap.database import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Model,
    String,
    Text,
    db,
    relationship,
)

from loader.context_explorer_loader import (
    load_context_explorer_context_analysis_dev,
    load_subtype_tree,
)
from loader.depmap_model_loader import load_subtype_contexts

# from .development_scripts import dev

namespace = Namespace("context_explorer", description="View context data in the portal")


DATA_AVAIL_FILE = "data_avail.csv"

GENE_INOUT_ANALYSIS_COLS = {
    "entity": str,
    "t_pval": float,
    "mean_in": float,
    "mean_out": float,
    "effect_size": float,
    "abs_effect_size": float,
    "t_qval": float,
    "t_qval_log": float,
    "n_dep_in": float,
    "n_dep_out": float,
    "frac_dep_in": float,
    "frac_dep_out": float,
    "selectivity_val": float,
    "depletion": str,
    "label": str,
}

DRUG_INOUT_ANALYSIS_COLS = {
    "entity": str,
    "t_pval": float,
    "mean_in": float,
    "mean_out": float,
    "effect_size": float,
    "abs_effect_size": float,
    "t_qval": float,
    "t_qval_log": float,
    "selectivity_val": float,
    "depletion": str,
    "label": str,
}


def _get_context_summary_df() -> pd.DataFrame:
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, "context_explorer_summary", DATA_AVAIL_FILE)
    overall_summary = pd.read_csv(path, index_col="ModelID")
    transposed_summary = overall_summary.transpose()

    return transposed_summary


def _get_context_summary():
    summary_df = _get_context_summary_df()

    summary = {
        "values": [row.values.tolist() for _, row in summary_df.iterrows()],
        "data_types": summary_df.index.values.tolist(),
    }

    summary["all_depmap_ids"] = [
        (i, depmap_id) for i, depmap_id in enumerate(summary_df.columns.tolist())
    ]

    return summary


def _get_all_level_0_subtype_info(
    all_trees: Dict[str, ContextExplorerTree],
) -> List[ContextNameInfo]:
    context_name_info = []

    for subtype_code in all_trees.keys():
        context_name_info.append(
            ContextNameInfo(
                name=all_trees[subtype_code].root.name,
                subtype_code=subtype_code,
                node_level=0,
            )
        )

    return context_name_info


def make_subtype_context_sample_data():
    all_subtype_nodes = SubtypeNode.get_all()
    all_models = DepmapModel.get_all()
    model_ids = [model.model_id for model in all_models]

    index = model_ids
    column_headers = []
    rows = []
    for node in all_subtype_nodes:
        subtype_code = node.subtype_code
        models_present = []
        column_headers.append(subtype_code)
        for model_id in model_ids:
            includes_model = DepmapModel.has_depmap_model_type(
                depmap_model_type=subtype_code, model_id=model_id
            )
            models_present.append(includes_model)

        rows.append(models_present)

    subtype_context_matrix = pd.DataFrame(
        data=rows, index=column_headers, columns=model_ids
    )
    subtype_context_matrix = subtype_context_matrix.transpose()
    breakpoint()
    subtype_context_matrix.to_csv("sample_subtype_matrix.csv")
    breakpoint()


@namespace.route("/context_info")
class ContextInfo(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        List of available context trees as a dictionary with keys as each available non-terminal node, and values
        as each available branch off of the key-node
        """
        # breakpoint()
        # Getting the top level lineages by querying the Lineage table result in data inconsistencies. We
        # don't have datatype information for all level 1 lineages. As a result, we have to get the data trees
        # first, and then use the keys to get the list of top level lineages for the search bar.
        # load_subtype_tree("/Users/amourey/Downloads/SubtypeTree.csv")
        # load_context_explorer_context_analysis_dev(
        #     "/Users/amourey/Documents/CEv2_sample_data_with_codes.csv"
        # )
        # db.session.commit()
        # breakpoint()
        # make_subtype_context_sample_data()
        # load_subtype_contexts(
        #     "/Users/amourey/dev/depmap-portal2/depmap-portal/portal-backend/sample_subtype_matrix.csv"
        # )
        # breakpoint()
        (
            context_trees,
            overview_data,
        ) = get_context_explorer_lineage_trees_and_table_data()

        context_name_info = _get_all_level_0_subtype_info(context_trees)
        return {
            "trees": context_trees,
            "table_data": overview_data,
            "search_options": [
                {
                    "subtype_code": name_info.subtype_code,
                    "name": name_info.name,
                    "node_level": name_info.node_level,
                }
                for name_info in context_name_info
            ],
        }


@namespace.route("/context_path")
class ContextPath(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        selected_code = request.args.get("selected_code")

        node_obj = SubtypeNode.get_by_code(selected_code)

        cols = [
            node_obj.level_0,
            node_obj.level_1,
            node_obj.level_2,
            node_obj.level_3,
            node_obj.level_4,
            node_obj.level_5,
        ]
        path = [col for col in cols if col != ""]

        return path


def _get_overview_table_data(
    df: pd.DataFrame, summary_df: pd.DataFrame
) -> pd.DataFrame:
    overview_page_table = df

    cell_line_display_names = DepmapModel.get_cell_line_display_names(
        list(summary_df.columns.values)
    )

    overview_page_table["crispr"] = summary_df.loc["CRISPR"] > 0
    overview_page_table["rnai"] = summary_df.loc["RNAi"] > 0
    overview_page_table["wgs"] = summary_df.loc["WGS"] > 0
    overview_page_table["wes"] = summary_df.loc["WES"] > 0
    overview_page_table["prism"] = summary_df.loc["PRISM"] > 0
    overview_page_table["rna_seq"] = summary_df.loc["RNASeq"] > 0
    overview_page_table["cell_line_display_name"] = cell_line_display_names[
        overview_page_table.index
    ]

    dummy_value = ""
    overview_page_table = overview_page_table.fillna(dummy_value)

    overview_page_table = overview_page_table.reset_index()
    overview_data = overview_page_table.to_dict("records")

    return overview_data


def get_context_explorer_lineage_trees_and_table_data() -> Tuple[
    Dict[str, ContextExplorerTree], List[Dict[str, Union[str, bool]]]
]:
    subtype_tree_query = SubtypeNode.get_subtype_tree_query()
    subtype_df = pd.read_sql(
        subtype_tree_query.statement, subtype_tree_query.session.connection()
    )

    summary_df = _get_context_summary_df()

    overview_data = _get_overview_table_data(df=subtype_df, summary_df=summary_df)

    subtype_tree_df = subtype_df[
        [
            "subtype_code",
            "node_name",
            "node_level",
            "level_0",
            "level_1",
            "level_2",
            "level_3",
            "level_4",
            "level_5",
        ]
    ]

    subtype_codes_and_names = subtype_df.loc[subtype_df["node_level"] == 0]
    subtype_codes_and_names_dict = subtype_codes_and_names.set_index(
        "subtype_code"
    ).to_dict()["node_name"]

    trees = {}
    for subtype_code in list(subtype_codes_and_names_dict.keys()):
        node_level = 0
        model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
            subtype_code, node_level
        )
        node_name = subtype_codes_and_names_dict[subtype_code]
        root_node = ContextNode(
            name=node_name,
            subtype_code=subtype_code,
            parent_subtype_code=None,
            model_ids=list(model_ids.keys()),
            node_level=node_level,
            root=None,
        )
        tree = ContextExplorerTree(root_node)

        tree.create_context_tree_from_root_info(
            tree_df=subtype_tree_df,
            current_node_code=subtype_code,
            node_level=node_level,
        )
        trees[subtype_code] = tree

    return trees, overview_data


@namespace.route("/context_summary")
class ContextSummary(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        List of available context trees as a dictionary with keys as each available non-terminal node, and values
        as each available branch off of the key-node
        """
        return _get_context_summary()


def _get_analysis_data_table(
    in_group: str,
    out_group_type: str,
    entity_type: Literal["gene", "compound"],
    dataset_name: str,
):
    if in_group == "All":
        return None

    # if out_group_type == "All":
    #    out_group_type = "All Others"  # HACK: Temporary until we agree on value options for outgroup types

    data = ContextAnalysis.find_context_analysis_by_subtype_code_out_group(
        subtype_code=in_group,
        out_group=out_group_type,
        entity_type=entity_type,
        dataset_name=dataset_name,
    )

    if data.empty:
        return None

    if entity_type == "gene":
        data["label"] = data["entity"]
        data["entity"] = data[["entity", "entrez_id"]].agg(
            lambda a: a[0] + f" ({str(a[1])})", axis=1
        )
    elif entity_type == "compound":

        def get_compound_label_for_compound_experiment(entity: str):
            compound_exp = CompoundExperiment.get_by_label(entity)
            compound = Compound.get_by_id(compound_exp.compound_id)
            return compound.label

        data["label"] = data["entity"].apply(get_compound_label_for_compound_experiment)
        # These columns don't make sense for compounds and will always be NaNs, so just drop them
        data = data.drop(
            ["n_dep_in", "n_dep_out", "frac_dep_in", "frac_dep_out"], axis=1
        )

    data["depletion"] = data["effect_size"] > 0
    data["depletion"] = data["depletion"].map({True: "True", False: "False"})
    data["abs_effect_size"] = data["effect_size"].abs()

    data_table = data.reset_index()
    data_table = data_table.round(decimals=3)

    # TODO: Add test for this endpoint to assert the proper columns are returned
    #  depending on "gene" or "compound" entity_type
    in_out_analysis_cols = (
        GENE_INOUT_ANALYSIS_COLS if entity_type == "gene" else DRUG_INOUT_ANALYSIS_COLS
    )

    data_table = {
        column: convert_series_to_json_safe_list(data_table[column], dtype=dtype)
        for column, dtype in in_out_analysis_cols.items()
    }

    return data_table


@namespace.route("/analysis_data")
class AnalysisData(Resource):
    @namespace.doc(
        description="Get all data for the Context Explorer gene dependency tab or the drug sensitivity tab.",
    )  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        in_group = request.args.get("in_group")
        out_group_type = request.args.get("out_group_type")
        entity_type = request.args.get("entity_type")

        # Can be either
        # DependencyEnum.Chronos_Combined.name
        # Repurposing aka DependencyEnum.Rep_all_single_pt.name
        # OncRef aka DependencyEnum.Prism_oncology_AUC.name
        dataset_name = request.args.get("dataset_name")

        # dev.load_context_explorer_sample_data()
        # breakpoint()

        data_table = _get_analysis_data_table(
            in_group=in_group,
            out_group_type=out_group_type,
            entity_type=entity_type,
            dataset_name=dataset_name,
        )

        return data_table


@namespace.route("/context_dose_curves")
class ContextDoseCurves(Resource):
    @namespace.doc(
        description="",
    )  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        dataset_name = request.args.get("dataset_name")
        entity_full_label = request.args.get("entity_full_label")
        context_name = request.args.get("context_name")
        level = request.args.get("level")

        # TODO calculate outgroup median using outgroup type instead of always using All Others
        out_group_type = "All Others"  # request.args.get("out_group_type")

        dose_curve_info = get_context_dose_curves(
            dataset_name=dataset_name,
            entity_full_label=entity_full_label,
            context_name=context_name,
            level=level,
            out_group_type=out_group_type,
        )

        compound_experiment = dose_curve_info["compound_experiment"]
        dataset = dose_curve_info["dataset"]
        replicate_dataset_name = dose_curve_info["replicate_dataset_name"]

        label = f"{compound_experiment.label} {dataset.display_name}"

        # TODO not sure if I need this metadata yet
        dose_curve_metadata = {
            "label": label,
            "id": f"{dataset.name.name}_{compound_experiment.entity_id}",  # used for uniqueness
            "dataset": dataset.name.name,
            "entity": compound_experiment.entity_id,
            "dose_replicate_dataset": replicate_dataset_name,
            "auc_dataset_display_name": dataset.display_name,
            "compound_label": compound_experiment.label,
            "compound_xref_full": compound_experiment.xref_full,
            "dose_replicate_level_yunits": DATASET_METADATA[
                dataset.get_dose_replicate_enum()
            ].units,
        }

        return {
            "in_group_curve_params": dose_curve_info["dose_curve_info"][
                "in_group_curve_params"
            ],
            "out_group_curve_params": dose_curve_info["dose_curve_info"][
                "out_group_curve_params"
            ],
            "max_dose": min(dose_curve_info["dose_curve_info"]["max_dose"], 1.0),
            "min_dose": dose_curve_info["dose_curve_info"]["min_dose"],
            "dose_curve_metadata": dose_curve_metadata,
        }


@namespace.route("/context_box_plot_data")
class ContextBoxPlotData(Resource):
    @namespace.doc(
        description="",
    )  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Used to get the main box plot data
        selected_context = request.args.get("selected_context")
        dataset_name = request.args.get("dataset_name")
        top_context = request.args.get("top_context")

        # Used to get Other Context Dependencies
        out_group_type = request.args.get("out_group_type")
        entity_type = request.args.get("entity_type")
        entity_full_label = request.args.get("entity_full_label")
        fdr = request.args.getlist("fdr", type=float)
        abs_effect_size = request.args.getlist("abs_effect_size", type=float)
        frac_dep_in = request.args.getlist("frac_dep_in", type=float)

        box_plot_data = []

        entity_id_and_label = get_entity_id_from_entity_full_label(
            entity_type=entity_type, entity_full_label=entity_full_label
        )
        entity_id = entity_id_and_label["entity_id"]
        entity_label = entity_id_and_label["label"]

        is_lineage = selected_context == top_context
        lineage_depmap_ids_names_dict = DepmapModel.get_model_ids_by_lineage_and_level(
            top_context
        )

        (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
            dataset_name=dataset_name, label=entity_full_label
        )
        entity_full_row_of_values.dropna(inplace=True)

        drug_dotted_line = (
            entity_full_row_of_values.mean() if entity_type == "compound" else None
        )

        if is_lineage:
            box_plot_data = get_box_plot_data_for_selected_lineage(
                top_context=top_context,
                lineage_depmap_ids=list(lineage_depmap_ids_names_dict.keys()),
                entity_full_row_of_values=entity_full_row_of_values,
                lineage_depmap_ids_names_dict=lineage_depmap_ids_names_dict,
            )
        else:
            box_plot_data = get_box_plot_data_for_primary_disease(
                selected_context=selected_context,
                top_context=top_context,
                lineage_depmap_ids=list(lineage_depmap_ids_names_dict.keys()),
                entity_full_row_of_values=entity_full_row_of_values,
                lineage_depmap_ids_names_dict=lineage_depmap_ids_names_dict,
            )

        other_context_dependencies = get_other_context_dependencies(
            in_group=selected_context,
            out_group_type=out_group_type,
            entity_type=entity_type,
            entity_id=entity_id,
            fdr=fdr,
            abs_effect_size=abs_effect_size,
            frac_dep_in=frac_dep_in,
            full_row_of_values=entity_full_row_of_values,
        )

        return {
            "box_plot_data": box_plot_data,
            "other_context_dependencies": other_context_dependencies,
            "drug_dotted_line": drug_dotted_line,
            "entity_label": entity_label,
        }
