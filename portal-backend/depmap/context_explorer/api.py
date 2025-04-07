import dataclasses
from typing import Any, Dict, List, Literal, Tuple, Union
import os
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound, CompoundExperiment
from depmap.context_explorer.utils import get_path_to_node
from depmap.context_explorer import box_plot_utils, dose_curve_utils
from depmap.tda.views import convert_series_to_json_safe_list
from flask_restplus import Namespace, Resource
from flask import current_app, request
import pandas as pd
from depmap.settings.shared import DATASET_METADATA
from depmap.context_explorer.models import (
    ContextAnalysis,
    ContextNode,
)
from depmap.context.models_new import SubtypeContext, SubtypeNode, TreeType

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


def _get_context_summary(tree_type: str):
    subtype_tree_query = SubtypeNode.get_all_by_models_query(tree_type)

    subtype_df = pd.read_sql(
        subtype_tree_query.statement, subtype_tree_query.session.connection()
    )
    valid_models = subtype_df["model_id"].tolist()

    summary_df = _get_context_summary_df()

    valid_models_summary_intersection = set.intersection(
        set(summary_df.columns.tolist()), valid_models
    )
    subsetted_summary_df = summary_df[list(valid_models_summary_intersection)]

    sorted_summary_df = None
    if current_app.config.get("ENABLED_FEATURES").context_explorer_prerelease_datasets:
        sorted_summary_df = subsetted_summary_df.sort_values(
            by=[
                "CRISPR",
                "RNAi",
                "WES",
                "WGS",
                "RNASeq",
                "PRISMOncRef",
                "PRISMRepurposing",
            ],
            axis=1,
            ascending=False,
        )
    else:
        sorted_summary_df = subsetted_summary_df.sort_values(
            by=["CRISPR", "RNAi", "WES", "WGS", "RNASeq", "PRISMRepurposing",],
            axis=1,
            ascending=False,
        )

    summary = {
        "values": sorted_summary_df.values.tolist(),
        "data_types": sorted_summary_df.index.values.tolist(),
    }

    summary["all_depmap_ids"] = [
        (i, depmap_id) for i, depmap_id in enumerate(sorted_summary_df.columns.tolist())
    ]

    subtype_df = subtype_df.set_index("model_id")
    overview_data = _get_overview_table_data(
        df=subtype_df, summary_df=sorted_summary_df
    )

    return summary, overview_data


def _get_all_level_0_subtype_info(tree_type: TreeType) -> List[dict]:
    subtype_nodes = SubtypeNode.get_by_tree_type_and_level(
        tree_type=tree_type.value, level=0
    )

    context_name_info = []

    for subtype_node in subtype_nodes:
        model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
            subtype_node.subtype_code, 0
        )
        context_name_info.append(
            {
                "name": subtype_node.node_name,
                "subtype_code": subtype_node.subtype_code,
                "node_level": 0,
                "numModels": len(model_ids),
            }
        )

    sorted_context_name_info_list = sorted(context_name_info, key=lambda x: x["name"])
    return sorted_context_name_info_list


@namespace.route("/context_search_options")
class ContextSearchOptions(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        molecular_subtype_context_name_info = _get_all_level_0_subtype_info(
            tree_type=TreeType.MolecularSubtype
        )
        lineage_context_name_info = _get_all_level_0_subtype_info(
            tree_type=TreeType.Lineage
        )

        return {
            "lineage": lineage_context_name_info,
            "molecularSubtype": molecular_subtype_context_name_info,
        }


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

        level_0_subtype_code = request.args.get("level_0_subtype_code")

        (
            context_tree,
            overview_data,
        ) = get_context_explorer_lineage_trees_and_table_data(
            level_0_subtype_code=level_0_subtype_code
        )

        return {"tree": context_tree, "table_data": overview_data}


@namespace.route("/context_path")
class ContextPath(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        selected_code = request.args.get("selected_code")

        path = get_path_to_node(selected_code)

        return dataclasses.asdict(path)


def get_child_subtype_summary_df(subtype_code: str):
    # Get the children for displaying in the data availability chart
    node = SubtypeNode.get_by_code(subtype_code)
    assert node is not None
    node_children = SubtypeNode.get_next_level_nodes_using_current_level_code(
        subtype_code, node.node_level
    )

    def is_model_available(model_id: str, node_model_ids: List[str]):
        return model_id in node_model_ids

    model_avail_by_node_code = {}
    all_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
        subtype_code, node.node_level
    )

    for child_node in node_children:
        model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
            subtype_code=child_node.subtype_code, node_level=child_node.node_level
        )
        if len(model_ids) == 0:
            continue
        model_id_availability = [
            is_model_available(model_id=model_id, node_model_ids=model_ids)
            for model_id in all_model_ids
        ]
        model_avail_by_node_code[child_node.subtype_code] = model_id_availability

    subtype_avail_df = pd.DataFrame(
        data=model_avail_by_node_code, index=pd.Index(all_model_ids, name="ModelID"),
    )

    return subtype_avail_df


@namespace.route("/subtype_data_availability")
class SubtypeDataAvailability(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        selected_code = request.args.get("selected_code")

        subtype_avail_summary = get_child_subtype_summary_df(subtype_code=selected_code)

        transposed_subtype_avail_summary = subtype_avail_summary.transpose()
        data_availability = {
            "values": [
                row.values.tolist()
                for _, row in transposed_subtype_avail_summary.iterrows()
            ],
            "data_types": transposed_subtype_avail_summary.index.values.tolist(),
        }

        data_availability["all_depmap_ids"] = [
            (i, depmap_id)
            for i, depmap_id in enumerate(
                transposed_subtype_avail_summary.columns.tolist()
            )
        ]

        return data_availability


def _get_overview_table(overview_page_table, summary_df_by_model_id):
    cell_line_display_names = DepmapModel.get_cell_line_display_names(
        list(summary_df_by_model_id.index.values)
    )

    overview_page_table_joined = overview_page_table.join(summary_df_by_model_id)

    overview_page_table_joined["cell_line_display_name"] = cell_line_display_names[
        summary_df_by_model_id.index
    ]

    overview_page_table_joined = overview_page_table_joined.rename(
        columns={
            "CRISPR": "crispr",
            "RNAi": "rnai",
            "WGS": "wgs",
            "WES": "wes",
            "PRISMOncRef": "oncref",
            "PRISMRepurposing": "repurposing",
            "RNASeq": "rna_seq",
        }
    )

    dummy_value = ""
    overview_page_table_joined = overview_page_table_joined.fillna(dummy_value)

    overview_page_table_joined = overview_page_table_joined.reset_index().drop_duplicates(
        "model_id", keep="last"
    )

    overview_page_table_joined = overview_page_table_joined.to_dict("records")

    return overview_page_table_joined


def _get_overview_table_data(
    df: pd.DataFrame, summary_df: pd.DataFrame
) -> List[Dict[str, Any]]:
    summary_df_by_model_id = summary_df.transpose()
    overview_page_table = df

    summary_df_by_model_id = summary_df_by_model_id.rename_axis("model_id")

    overview_data = _get_overview_table(
        overview_page_table=overview_page_table,
        summary_df_by_model_id=summary_df_by_model_id,
    )

    return overview_data


def get_context_explorer_lineage_trees_and_table_data(
    level_0_subtype_code: str,
) -> Tuple[Dict[str, ContextNode], List[Dict[str, Union[str, bool]]]]:
    node = SubtypeNode.get_by_code(level_0_subtype_code)
    assert node is not None

    subtype_tree_query = SubtypeNode.get_subtype_tree_by_models_query(
        node.tree_type, level_0_subtype_code
    )

    subtype_df = pd.read_sql(
        subtype_tree_query.statement, subtype_tree_query.session.connection()
    )

    summary_df = _get_context_summary_df()

    subtype_df = subtype_df.set_index("model_id")

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

    node_level = 0

    model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
        level_0_subtype_code, node_level
    )
    node_name = node.node_name
    root_node = ContextNode(
        name=node_name,
        subtype_code=level_0_subtype_code,
        parent_subtype_code=None,
        model_ids=model_ids,
        node_level=node_level,
    )

    root_node.create_context_tree_from_root_info(
        tree_df=subtype_tree_df,
        current_node_code=level_0_subtype_code,
        node_level=node_level,
    )

    return root_node, overview_data


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
        tree_type = request.args.get("tree_type")
        summary, overview_data = _get_context_summary(tree_type)

        return {"summary": summary, "table": overview_data}


def _get_analysis_data_table(
    in_group: str,
    out_group_type: str,
    entity_type: Literal["gene", "compound"],
    dataset_name: str,
):
    if in_group == "All":
        return None

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
        subtype_code = request.args.get("subtype_code")
        level = request.args.get("level")
        out_group_type = request.args.get("out_group_type")
        tree_type = request.args.get("tree_type")

        dose_curve_info = dose_curve_utils.get_context_dose_curves(
            dataset_name=dataset_name,
            entity_full_label=entity_full_label,
            subtype_code=subtype_code,
            level=level,
            out_group_type=out_group_type,
            tree_type=tree_type,
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
        selected_subtype_code = request.args.get("selected_subtype_code")
        tree_type = request.args.get("tree_type")
        dataset_name = request.args.get("dataset_name")
        entity_type = request.args.get("entity_type")
        entity_full_label = request.args.get("entity_full_label")
        max_fdr = request.args.get("max_fdr", type=float)
        min_abs_effect_size = request.args.get("min_abs_effect_size", type=float)
        min_frac_dep_in = request.args.get("min_frac_dep_in", type=float)

        context_box_plot_data = box_plot_utils.get_organized_contexts(
            selected_subtype_code=selected_subtype_code,
            tree_type=tree_type,
            entity_type=entity_type,
            entity_full_label=entity_full_label,
            dataset_name=dataset_name,
            max_fdr=max_fdr,
            min_abs_effect_size=min_abs_effect_size,
            min_frac_dep_in=min_frac_dep_in,
        )

        if context_box_plot_data is None:
            return None

        return dataclasses.asdict(context_box_plot_data)


@namespace.route("/context_node_name")
class ContextNodeName(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        List of available context trees as a dictionary with keys as each available non-terminal node, and values
        as each available branch off of the key-node
        """
        subtype_code = request.args.get("subtype_code")
        node = SubtypeNode.get_by_code(subtype_code, must=False)

        if subtype_code == "Other Heme":
            assert node is None
            return None

        return node.node_name
