from operator import mod
from typing import Dict, List, Literal, Tuple, Union
import os
import re
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound, CompoundExperiment
from depmap.context_explorer.utils import (
    get_box_plot_data_for_other_category,
    get_box_plot_data_for_context,
    get_full_row_of_values_and_depmap_ids,
    get_context_dose_curves,
    get_entity_id_from_entity_full_label,
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
    ContextExplorerTree,
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


from taigapy import create_taiga_client_v3


def make_subtype_context_sample_data():
    tc = create_taiga_client_v3()

    molecular_subtype_df = tc.get(
        "internal-24q4-8c04.116/OmicsInferredMolecularSubtypes"
    )  # "TRUE" and "FALSE" values
    molecular_subtype_df = molecular_subtype_df.dropna().set_index("ModelID")

    all_subtype_nodes = SubtypeNode.get_all_organized_descending_by_level()
    all_models = DepmapModel.get_all()
    model_ids = [model.model_id for model in all_models]

    column_headers = []
    rows = []

    for node in all_subtype_nodes:
        subtype_code = node.subtype_code
        print(subtype_code)
        node_name = node.node_name

        if node.molecular_subtype_code:
            node_level = node.node_level
            children_nodes = SubtypeNode.get_children_using_current_level_code(
                subtype_code, must=False
            )
            if (
                subtype_code in molecular_subtype_df.columns.tolist()
                or node_name in molecular_subtype_df.columns.tolist()
                or len(children_nodes) != 0
            ):
                models_present = []
                column_headers.append(subtype_code)

                for model_id in model_ids:
                    if (
                        node_name in molecular_subtype_df.columns.tolist()
                        and node_level != 0
                    ):
                        models = molecular_subtype_df[
                            molecular_subtype_df[node_name] == True
                        ].index.tolist()
                        includes_model = model_id in models
                        models_present.append(includes_model)

                    if node_level == 0:
                        # combine the TRUEs of the children
                        # children models would be adding the models present for every node level that has a level_0 of this code

                        models_for_children = []
                        node_level_1 = None
                        node_level_2 = None
                        node_level_3 = None
                        node_level_4 = None
                        node_level_5 = None
                        for child in children_nodes:
                            if child.node_level == 1:
                                node_level_1 = child
                            elif child.node_level == 2:
                                node_level_2 = child
                            elif child.node_level == 3:
                                node_level_3 = child
                            elif child.node_level == 4:
                                node_level_4 = child
                            elif child.node_level == 5:
                                node_level_5 = child

                        if node_level_1:
                            models1 = molecular_subtype_df[
                                molecular_subtype_df[node_level_1.node_name] == True
                            ].index.tolist()
                            models_for_children.extend(models1)

                        if node_level_2:
                            models2 = molecular_subtype_df[
                                molecular_subtype_df[node_level_2.node_name] == True
                            ].index.tolist()
                            models_for_children.extend(models2)

                        if node_level_3:
                            models3 = molecular_subtype_df[
                                molecular_subtype_df[node_level_3.node_name] == True
                            ].index.tolist()
                            models_for_children.extend(models3)

                        if node_level_4:
                            models4 = molecular_subtype_df[
                                molecular_subtype_df[node_level_4.node_name] == True
                            ].index.tolist()
                            models_for_children.extend(models4)

                        if node_level_5:
                            models5 = molecular_subtype_df[
                                molecular_subtype_df[node_level_5.node_name] == True
                            ].index.tolist()
                            models_for_children.extend(models5)

                        includes_model = model_id in models_for_children
                        models_present.append(includes_model)

                rows.append(models_present)
        else:
            models_present = []
            column_headers.append(subtype_code)
            node_level = node.node_level

            for model_id in model_ids:

                models = SubtypeNode.temporary_get_model_ids_by_subtype_code_and_node_level(
                    subtype_code=subtype_code, node_level=node_level
                )
                includes_model = model_id in models
                models_present.append(includes_model)

            rows.append(models_present)

    subtype_context_matrix = pd.DataFrame(
        data=rows, index=column_headers, columns=model_ids
    )
    subtype_context_matrix = subtype_context_matrix.transpose()
    subtype_context_matrix.to_csv(
        "sample_subtype_matrix_with_molecular_subtypesFINAlFIXED.csv"
    )


def load_context_exp_sample_data():
    full_tree = pd.read_csv("/Users/amourey/Downloads/alison-test_v17-subtypetree.csv")

    level_0_nodes_of_interest = [
        "Bone",
        "Brain",
        "Lung",
        "Lymphoid",
        "Myeloid",
        "ALK Hotspot",
        "EGFR",
    ]
    subsetted_tree = full_tree[full_tree["Level0"].isin(level_0_nodes_of_interest)]

    subsetted_tree.to_csv("subtype_tree.csv")


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

        # load_context_exp_sample_data()
        # print("HERE")
        # make_subtype_context_sample_data()
        # breakpoint()
        # load_subtype_tree(
        #     "/Users/amourey/dev/Context Explorer Data/SubtypeTree_FINAL.csv"
        # )
        # db.session.commit()
        # load_subtype_contexts(
        #     "/Users/amourey/dev/Context Explorer Data/ContextMatrix_FINAL.csv"
        # )
        # db.session.commit()
        # breakpoint()

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
        # breakpoint()
        # # Getting the top level lineages by querying the Lineage table result in data inconsistencies. We
        # # don't have datatype information for all level 1 lineages. As a result, we have to get the data trees
        # # first, and then use the keys to get the list of top level lineages for the search bar.
        # load_subtype_tree("/Users/amourey/dev/Context Explorer Data/SubtypeTree2.csv")
        # # load_context_explorer_context_analysis_dev(
        # #     "/Users/amourey/Documents/CEv2_sample_data_with_codes.csv"
        # # )
        # # db.session.commit()
        # # breakpoint()
        # make_subtype_context_sample_data()
        # load_subtype_contexts(
        #     "/Users/amourey/dev/Context Explorer Data/sample_subtype_matrix_with_molecular_subtypes.csv"
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

        node_obj = SubtypeNode.get_by_code(selected_code)

        cols = [
            node_obj.level_0,
            node_obj.level_1,
            node_obj.level_2,
            node_obj.level_3,
            node_obj.level_4,
            node_obj.level_5,
        ]
        path = [col for col in cols if col != None]

        return path


def _get_overview_table_data(
    df: pd.DataFrame, summary_df: pd.DataFrame
) -> pd.DataFrame:
    overview_page_table = df

    summary_df_by_model_id = summary_df.transpose()
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
) -> Tuple[Dict[str, ContextExplorerTree], List[Dict[str, Union[str, bool]]]]:
    node = SubtypeNode.get_by_code(level_0_subtype_code)

    subtype_tree_query = SubtypeNode.get_subtype_tree_by_models_query(
        node.tree_type, level_0_subtype_code
    )

    subtype_df = pd.read_sql(
        subtype_tree_query.statement, subtype_tree_query.session.connection()
    )

    subtype_df = subtype_df.set_index("model_id")
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

    node_level = 0
    subtype_context = SubtypeContext.get_by_code(level_0_subtype_code)
    model_ids = SubtypeContext.get_model_ids_by_node_level(subtype_context, node_level)
    node_name = node.node_name
    root_node = ContextNode(
        name=node_name,
        subtype_code=level_0_subtype_code,
        parent_subtype_code=None,
        model_ids=model_ids,
        node_level=node_level,
        root=None,
    )
    tree = ContextExplorerTree(root_node)

    tree.create_context_tree_from_root_info(
        tree_df=subtype_tree_df,
        current_node_code=level_0_subtype_code,
        node_level=node_level,
    )

    return tree, overview_data


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


@namespace.route("/context_box_plot_data")
class ContextBoxPlotData(Resource):
    @namespace.doc(
        description="",
    )  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        selected_subtype_code = request.args.get("selected_subtype_code")
        tree_type = request.args.get("tree_type")
        out_group = request.args.get("out_group")
        dataset_name = request.args.get("dataset_name")
        entity_type = request.args.get("entity_type")
        entity_full_label = request.args.get("entity_full_label")
        fdr = request.args.getlist("fdr", type=float)
        abs_effect_size = request.args.getlist("abs_effect_size", type=float)
        frac_dep_in = request.args.getlist("frac_dep_in", type=float)

        box_plot_data_list = []

        entity_id_and_label = get_entity_id_from_entity_full_label(
            entity_type=entity_type, entity_full_label=entity_full_label
        )
        entity_id = entity_id_and_label["entity_id"]
        entity_label = entity_id_and_label["label"]

        # find all of the other significant contexts
        other_sig_contexts = ContextAnalysis.get_other_context_dependencies(
            subtype_code=selected_subtype_code,
            tree_type=tree_type,
            out_group=out_group,
            entity_id=entity_id,
            dataset_name=dataset_name,
            entity_type=entity_type,
            fdr=fdr,
            abs_effect_size=abs_effect_size,
            frac_dep_in=frac_dep_in,
        )

        other_sig_contexts_subtype_codes = [
            context.subtype_code for context in other_sig_contexts
        ]

        contexts_to_plot = SubtypeContext.get_model_ids_for_node_branch(
            other_sig_contexts_subtype_codes
        )

        (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
            dataset_name=dataset_name, label=entity_label
        )
        entity_full_row_of_values.dropna(inplace=True)

        drug_dotted_line = (
            entity_full_row_of_values.mean() if entity_type == "compound" else None
        )

        heme_box_plot_data = {}
        solid_box_plot_data = {}

        if contexts_to_plot != None:
            for subtype_code in contexts_to_plot.keys():
                box_plot_data = get_box_plot_data_for_context(
                    subtype_code=subtype_code,
                    entity_full_row_of_values=entity_full_row_of_values,
                    model_ids_per_context=contexts_to_plot[subtype_code],
                )
                box_plot_data_list.append(box_plot_data)

            heme_box_plot_data = get_box_plot_data_for_other_category(
                category="heme",
                significant_subtype_codes=list(contexts_to_plot.keys()),
                entity_full_row_of_values=entity_full_row_of_values,
            )

            solid_box_plot_data = get_box_plot_data_for_other_category(
                category="solid",
                significant_subtype_codes=list(contexts_to_plot.keys()),
                entity_full_row_of_values=entity_full_row_of_values,
            )

        return {
            "box_plot_data": box_plot_data_list,
            "other_heme_data": heme_box_plot_data,
            "other_solid_data": solid_box_plot_data,
            "drug_dotted_line": drug_dotted_line,
            "entity_label": entity_label,
        }
