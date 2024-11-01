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
    has_drug_data,
    has_gene_dep_data,
    get_dose_response_curves_per_model,
    get_out_group_model_ids,
)
from depmap.gene.models import Gene
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
from .development_scripts import dev

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


def _get_all_top_level_lineages(
    all_lineages: Dict[str, ContextExplorerTree],
) -> List[ContextNameInfo]:
    unique_top_level_lineages = []

    seen_lineage_names = []
    for lineage in all_lineages.keys():
        if lineage not in seen_lineage_names:
            unique_top_level_lineages.append(
                ContextNameInfo(
                    name=lineage, display_name=all_lineages[lineage].root.display_name
                )
            )
            seen_lineage_names.append(lineage)

    return unique_top_level_lineages


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

        # Getting the top level lineages by querying the Lineage table result in data inconsistencies. We
        # don't have datatype information for all level 1 lineages. As a result, we have to get the data trees
        # first, and then use the keys to get the list of top level lineages for the search bar.
        (
            context_trees,
            overview_data,
        ) = get_context_explorer_lineage_trees_and_table_data()
        context_name_info = _get_all_top_level_lineages(context_trees)
        return {
            "trees": context_trees,
            "table_data": overview_data,
            "search_options": [
                {"name": name_info.name, "display_name": name_info.display_name}
                for name_info in context_name_info
            ],
        }


def _get_overview_table_data(
    df: pd.DataFrame, summary_df: pd.DataFrame
) -> pd.DataFrame:
    overview_page_table = df[["lineage_1", "lineage_2", "lineage_3", "lineage_6"]]
    overview_page_table.rename(
        columns={
            "lineage_1": "lineage",
            "lineage_2": "primary_disease",
            "lineage_3": "subtype",
            "lineage_6": "molecular_subtype",
        },
        inplace=True,
    )

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

    # Get a list of crispr_depmap_ids and prism_depmap_ids so that we can store
    # hasGenDepData and hasDrugData as fields in the ContextExplorerTree.
    crispr_depmap_ids = overview_page_table[
        overview_page_table["crispr"] == True
    ].index.tolist()
    drug_depmap_ids = overview_page_table[
        overview_page_table["prism"] == True
    ].index.tolist()

    overview_page_table = overview_page_table.reset_index()
    overview_data = overview_page_table.to_dict("records")

    return overview_data, crispr_depmap_ids, drug_depmap_ids


# lineage_1: oncotree_lineage
# lineage_2: oncotree_primary_disease
# lineage_3: oncotree_subtype
# lineage_6: legacy_molecular_subtype


def get_context_explorer_lineage_trees_and_table_data() -> Tuple[
    Dict[str, ContextExplorerTree], List[Dict[str, Union[str, bool]]]
]:
    query = DepmapModel.get_context_tree_query()
    df = pd.read_sql(query.statement, query.session.connection())
    df = df.rename(columns={"model_id": "depmap_id"})

    # Filter out lineages that don't have depmap_ids in the summary data
    summary_df = _get_context_summary_df()
    df = df[df["depmap_id"].isin(list(summary_df.columns))]

    # Get lineage_df (with list of depmap_ids per lineage), so that given a lineage
    # name, we can easily get the list of depmap_ids for that lienage
    lineage_by_level = df.copy()
    lineage_by_level["lineage_by_level"] = lineage_by_level[
        ["lineage", "lineage_level"]
    ].values.tolist()
    lineage_by_level["lineage_by_level"] = lineage_by_level["lineage_by_level"].apply(
        tuple
    )

    lineage_df = pd.pivot_table(
        lineage_by_level,
        values=["lineage", "depmap_id", "lineage_level"],
        index="lineage_by_level",
        aggfunc={"depmap_id": list, "lineage_level": list},
    )

    df["lineage_level"] = "lineage_" + df["lineage_level"].astype(str)
    inds = df.columns.difference(["lineage_level", "lineage"]).tolist()
    dummy_value = ""
    df = df.fillna(dummy_value)
    df = df.pivot_table(
        index=inds, columns="lineage_level", values="lineage", aggfunc="first"
    )

    overview_data, crispr_depmap_ids, drug_depmap_ids = _get_overview_table_data(
        df=df, summary_df=summary_df
    )

    # NOTE: TEMPORARY - per Barbara's instructions, dropping all but the first 2 lineage levels for the prototype
    df = df.drop(columns=["lineage_3", "lineage_5", "lineage_6"])
    lineage_1_sorted = df.sort_values("lineage_1")
    unique_lineage_1 = lineage_1_sorted["lineage_1"].unique()

    trees = {}
    for unique_lineage in unique_lineage_1:
        if pd.isna(unique_lineage):
            continue

        lineage_row = lineage_df.loc[lineage_df.index == (unique_lineage, 1)]

        # If we don't take the unique depmap_ids, some depmap_ids are
        # counted twice if they have the same lineage listed at 2 different
        # levels (for example: Bone --> Ewing Sarcoma --> Ewing Sarcoma)
        depmap_ids = (
            list(set(lineage_row["depmap_id"].iloc[[0]].values[0]))
            if len(lineage_row["depmap_id"]) != 0
            else []
        )
        root_node = ContextNode(
            name=unique_lineage,
            depmap_ids=depmap_ids,
            has_gene_dep_data=has_gene_dep_data,
            has_drug_data=has_drug_data,
            crispr_depmap_ids=crispr_depmap_ids,
            drug_depmap_ids=drug_depmap_ids,
        )
        tree = ContextExplorerTree(root_node)

        tree_df = lineage_1_sorted.loc[lineage_1_sorted["lineage_1"] == unique_lineage]

        tree.create_context_tree_from_root_info(
            tree_df=tree_df,
            current_lineage=unique_lineage,
            lineage_df=lineage_df,
            current_lineage_level="lineage_1",
            has_gene_dep_data=has_gene_dep_data,
            has_drug_data=has_drug_data,
            crispr_depmap_ids=crispr_depmap_ids,
            drug_depmap_ids=drug_depmap_ids,
        )
        trees[unique_lineage] = tree

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
    dataset_id: str,
):
    if in_group == "All":
        return None

    data = ContextAnalysis.find_context_analysis_by_context_name_out_group(
        context_name=in_group,
        out_group="All Others",
        entity_type=entity_type,
        dataset_id=dataset_id,
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
        dataset_id = request.args.get("dataset_id")

        # dev.load_context_explorer_sample_data()
        # breakpoint()

        data_table = _get_analysis_data_table(
            in_group=in_group,
            out_group_type=out_group_type,
            entity_type=entity_type,
            dataset_id=dataset_id,
        )

        return data_table


def _get_compound_experiment_id_from_entity_label(entity_full_label: str):
    m = re.search(r"([A-Z0-9]*:[A-Z0-9-]*)", entity_full_label)
    compound_experiment_id = m.group(1)

    return compound_experiment_id


def _get_compound_experiment(entity_full_label: str):
    compound_experiment_id = _get_compound_experiment_id_from_entity_label(
        entity_full_label=entity_full_label
    )

    assert ":" in compound_experiment_id
    compound_experiment = CompoundExperiment.get_by_xref_full(
        compound_experiment_id, must=False
    )

    return compound_experiment


def _get_entity_id_from_entity_full_label(
    entity_type: str, entity_full_label: str
) -> dict:
    entity = None
    if entity_type == "gene":
        m = re.match("\\S+ \\((\\d+)\\)", entity_full_label)

        assert m is not None
        entrez_id = int(m.group(1))
        gene = Gene.get_gene_by_entrez(entrez_id)
        assert gene is not None
        label = gene.label
        entity = gene
        entity_id = entity.entity_id
    else:
        compound_experiment = _get_compound_experiment(
            entity_full_label=entity_full_label
        )
        entity_id = compound_experiment.entity_id
        label = Compound.get_by_entity_id(entity_id).label

    return {"entity_id": entity_id, "label": label}


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
        out_group_type = request.args.get("out_group_type")

        dataset = DependencyDataset.get_dataset_by_name(dataset_name)
        replicate_dataset_name = dataset.get_dose_replicate_enum().name
        compound_experiment = _get_compound_experiment(
            entity_full_label=entity_full_label
        )

        # TODO this needs to be updated to query the new context tree for the list of models
        in_group_model_ids = DepmapModel.get_model_ids_by_lineage_and_level(
            context_name, level
        ).keys()
        out_group_model_ids = get_out_group_model_ids(
            "All Others",  # TODO UPDATE THIS TO USE out_group_type
            dataset_name=dataset_name,
            in_group_model_ids=in_group_model_ids,
            label=entity_full_label,
        )

        dose_curve_info = get_dose_response_curves_per_model(
            in_group_model_ids=in_group_model_ids,
            out_group_model_ids=out_group_model_ids,
            replicate_dataset_name=replicate_dataset_name,
            compound_experiment=compound_experiment,
        )

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
            "in_group_curve_params": dose_curve_info["in_group_curve_params"],
            "out_group_curve_params": dose_curve_info["out_group_curve_params"],
            "max_dose": min(dose_curve_info["max_dose"], 1.0),
            "min_dose": dose_curve_info["min_dose"],
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
        dataset_id = request.args.get("dataset_id")
        top_context = request.args.get("top_context")

        # Used to get Other Context Dependencies
        out_group_type = request.args.get("out_group_type")
        entity_type = request.args.get("entity_type")
        entity_full_label = request.args.get("entity_full_label")
        fdr = request.args.getlist("fdr", type=float)
        abs_effect_size = request.args.getlist("abs_effect_size", type=float)
        frac_dep_in = request.args.getlist("frac_dep_in", type=float)

        box_plot_data = []

        entity_id_and_label = _get_entity_id_from_entity_full_label(
            entity_type=entity_type, entity_full_label=entity_full_label
        )
        entity_id = entity_id_and_label["entity_id"]
        entity_label = entity_id_and_label["label"]

        is_lineage = selected_context == top_context
        lineage_depmap_ids_names_dict = DepmapModel.get_model_ids_by_lineage_and_level(
            top_context
        )

        (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
            dataset_id=dataset_id, label=entity_full_label
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
