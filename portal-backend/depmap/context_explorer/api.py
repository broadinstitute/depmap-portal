from typing import Dict, List, Literal, Tuple, Union
import os
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound, CompoundExperiment
from depmap.context_explorer.utils import (
    get_box_plot_data_for_other_category,
    get_box_plot_data_for_context,
    get_full_row_of_values_and_depmap_ids,
    get_context_dose_curves,
    get_entity_id_from_entity_full_label,
    get_box_plot_card_data,
    get_branch_subtype_codes_organized_by_code,
    get_path_to_node,
)
from depmap.tda.views import convert_series_to_json_safe_list
from flask_restplus import Namespace, Resource
from flask import current_app, request
import pandas as pd
from depmap.context.models_new import SubtypeContext
from depmap.settings.shared import DATASET_METADATA
from depmap.context_explorer.models import (
    ContextAnalysis,
    ContextNode,
)
from depmap.context.models_new import SubtypeNode, TreeType
from depmap.database import db
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


def _get_all_level_0_subtype_info(tree_type: TreeType) -> List[dict]:
    subtype_nodes = SubtypeNode.get_by_tree_type_and_level(tree_type=tree_type, level=0)

    context_name_info = []

    for subtype_node in subtype_nodes:
        context_name_info.append(
            {
                "name": subtype_node.node_name,
                "subtype_code": subtype_node.subtype_code,
                "node_level": 0,
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
        # load_context_explorer_context_analysis_dev(
        #     "/Users/amourey/dev/Context Explorer Data/ContextAnalysisDataSample.csv"
        # )
        # db.session.commit()
        # breakpoint()

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

        return path


def get_child_subtype_summary_df(subtype_code: str):
    # Get the children for displaying in the data availability chart
    node = SubtypeNode.get_by_code(subtype_code)
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


def _get_overview_table_data(
    df: pd.DataFrame, summary_df: pd.DataFrame
) -> pd.DataFrame:
    summary_df_by_model_id = summary_df.transpose()
    overview_page_table = df

    summary_df_by_model_id = summary_df_by_model_id.rename_axis("model_id")

    cell_line_display_names = DepmapModel.get_cell_line_display_names(
        list(summary_df_by_model_id.index.values)
    )

    overview_page_table = overview_page_table.join(summary_df_by_model_id)

    overview_page_table["cell_line_display_name"] = cell_line_display_names[
        summary_df_by_model_id.index
    ]

    overview_page_table = overview_page_table.rename(
        columns={
            "CRISPR": "crispr",
            "RNAi": "rnai",
            "WGS": "wgs",
            "WES": "wes",
            "PRISM": "prism",
            "RNASeq": "rna_seq",
        }
    )

    dummy_value = ""
    overview_page_table = overview_page_table.fillna(dummy_value)

    overview_page_table = overview_page_table.reset_index().drop_duplicates(
        "model_id", keep="last"
    )

    overview_data = overview_page_table.to_dict("records")

    return overview_data


def get_context_explorer_lineage_trees_and_table_data(
    level_0_subtype_code: str,
) -> Tuple[Dict[str, ContextNode], List[Dict[str, Union[str, bool]]]]:
    node = SubtypeNode.get_by_code(level_0_subtype_code)

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
        return _get_context_summary()


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

        # TODO calculate outgroup median using outgroup type instead of always using All Others
        out_group_type = "All Others"  # request.args.get("out_group_type")

        dose_curve_info = get_context_dose_curves(
            dataset_name=dataset_name,
            entity_full_label=entity_full_label,
            subtype_code=subtype_code,
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


@namespace.route("/subtype_branch_box_plot_data")
class SubtypeBranchBoxPlotData(Resource):
    @namespace.doc(
        description="",
    )  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # The level_0 context will be displayed on a accordion card with its box plot
        # The user can click the carot to open the card.
        # On click we want to load the signficant children of that level_0. Include the level_0
        # for if they collapse it again. Any children non signficant sort into
        # "Other {level_0_code}"
        level_0_code = request.args.get("selected_subtype_code")
        tree_type = request.args.get("tree_type")
        dataset_name = request.args.get("dataset_name")
        entity_type = request.args.get("entity_type")
        entity_full_label = request.args.get("entity_full_label")
        fdr = request.args.getlist("fdr", type=float)
        abs_effect_size = request.args.getlist("abs_effect_size", type=float)
        frac_dep_in = request.args.getlist("frac_dep_in", type=float)

        entity_id_and_label = get_entity_id_from_entity_full_label(
            entity_type=entity_type, entity_full_label=entity_full_label
        )
        entity_id = entity_id_and_label["entity_id"]
        entity_label = entity_id_and_label["label"]

        (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
            dataset_name=dataset_name, label=entity_label
        )
        entity_full_row_of_values.dropna(inplace=True)

        # find all of the significant children for this particular level_0.
        sig_contexts = ContextAnalysis.get_context_dependencies(
            level_0_code=level_0_code,
            tree_type=tree_type,
            entity_id=entity_id,
            dataset_name=dataset_name,
            entity_type=entity_type,
            fdr=fdr,
            abs_effect_size=abs_effect_size,
            frac_dep_in=frac_dep_in,
            do_get_other_branch_0s=False,
        )

        all_sig_context_codes = sig_contexts["subtype_code"].to_list()
        model_ids_by_code = SubtypeContext.get_model_ids_for_node_branch(
            all_sig_context_codes, level_0_subtype_code=level_0_code
        )

        if model_ids_by_code is {}:
            {
                "significant_box_plot_data": None,
                "insignificant_box_plot_data": None,
            }

        box_plot_card_data = get_box_plot_card_data(
            level_0_code=level_0_code,
            all_sig_context_codes=all_sig_context_codes,
            model_ids_by_code=model_ids_by_code,
            entity_full_row_of_values=entity_full_row_of_values,
            include_level_0=False,
        )

        return {
            "significant_box_plot_data": box_plot_card_data["significant"],
            "insignificant_box_plot_data": box_plot_card_data["insignificant"],
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
        fdr = request.args.getlist("fdr", type=float)
        abs_effect_size = request.args.getlist("abs_effect_size", type=float)
        frac_dep_in = request.args.getlist("frac_dep_in", type=float)

        # If this doesn't find the node, something is wrong with how we
        # loaded the SubtypeNode database table data.
        selected_node = SubtypeNode.get_by_code(selected_subtype_code)
        level_0 = selected_node.level_0

        entity_id_and_label = get_entity_id_from_entity_full_label(
            entity_type=entity_type, entity_full_label=entity_full_label
        )
        entity_id = entity_id_and_label["entity_id"]
        entity_label = entity_id_and_label["label"]

        # find all of the significant contexts across all level_0s.
        sig_contexts = ContextAnalysis.get_context_dependencies(
            level_0_code=level_0,
            tree_type=tree_type,
            entity_id=entity_id,
            dataset_name=dataset_name,
            entity_type=entity_type,
            fdr=fdr,
            abs_effect_size=abs_effect_size,
            frac_dep_in=frac_dep_in,
            do_get_other_branch_0s=True,
        )

        all_sig_context_codes = sig_contexts["subtype_code"].to_list()
        sig_contexts_agg = (
            sig_contexts.groupby("level_0").agg({"subtype_code": list}).reset_index()
        )
        sig_contexts_by_level_0 = sig_contexts_agg.set_index("level_0").to_dict()[
            "subtype_code"
        ]

        branch_contexts = get_branch_subtype_codes_organized_by_code(
            contexts=sig_contexts_by_level_0, level_0=level_0
        )
        all_significant_level_0_codes = branch_contexts.keys()

        (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
            dataset_name=dataset_name, label=entity_label
        )
        entity_full_row_of_values.dropna(inplace=True)

        drug_dotted_line = (
            entity_full_row_of_values.mean() if entity_type == "compound" else None
        )

        heme_box_plot_data = {}
        solid_box_plot_data = {}
        other_sig_level_0_box_plot_data = {}
        box_plot_card_data = {}

        if branch_contexts != None:
            assert level_0 in branch_contexts.keys()
            selected_context_level_0 = branch_contexts[level_0]
            if selected_context_level_0 != None:
                box_plot_card_data = get_box_plot_card_data(
                    level_0_code=level_0,
                    all_sig_context_codes=all_sig_context_codes,
                    model_ids_by_code=selected_context_level_0,
                    entity_full_row_of_values=entity_full_row_of_values,
                )

            for other_level_0 in all_significant_level_0_codes:
                # Is it another signficant level 0? We need a new box plot grouping.
                if level_0 != other_level_0:
                    context_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
                        subtype_code=other_level_0, node_level=0
                    )
                    if len(context_model_ids) >= 5:
                        box_plot = get_box_plot_data_for_context(
                            subtype_code=other_level_0,
                            entity_full_row_of_values=entity_full_row_of_values,
                            model_ids=context_model_ids,
                        )
                        other_sig_level_0_box_plot_data[other_level_0] = box_plot

            heme_box_plot_data = get_box_plot_data_for_other_category(
                category="heme",
                significant_subtype_codes=all_sig_context_codes,
                entity_full_row_of_values=entity_full_row_of_values,
            )

            solid_box_plot_data = get_box_plot_data_for_other_category(
                category="solid",
                significant_subtype_codes=all_sig_context_codes,
                entity_full_row_of_values=entity_full_row_of_values,
            )

        significant_selection = (
            None if not box_plot_card_data else box_plot_card_data["significant"]
        )
        insignifcant_selection = (
            None if not box_plot_card_data else box_plot_card_data["insignificant"]
        )

        return {
            "significant_selection": significant_selection,
            "insignifcant_selection": insignifcant_selection,
            # For "signficant_other", only grab the level_0s. We will lazy load the
            # children of each level_0 as its boxplot "card" is clicked
            "significant_other": other_sig_level_0_box_plot_data,
            "insignificant_heme_data": heme_box_plot_data,
            "insignificant_solid_data": solid_box_plot_data,
            "drug_dotted_line": drug_dotted_line,
            "entity_label": entity_label,
        }
