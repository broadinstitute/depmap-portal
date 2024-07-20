import json
import os
from typing import List
import logging

import csv
import igraph
import numpy as np
import pandas as pd
from flask import Blueprint, render_template, request, current_app, abort
from flask_restplus import Api, Resource
from werkzeug.datastructures import FileStorage
from depmap.vector_catalog.trees import InteractiveTree

from depmap.constellation.utils import (
    select_n_features,
    rename_columns,
    add_geneset_positions,
    read_genesets,
    calculate_overrepresentation,
    SimilarityOption,
    ConnectivityOption,
    GENE_SETS_FILE,
    TopFeatureEnum,
)
from depmap.constellation import view_models
from depmap.dataset.models import DependencyDataset
from depmap.extensions import csrf_protect, restplus_handle_exception
from depmap.utilities.flask_utils import make_error
import depmap.constellation.utils as constellation_utils

blueprint = Blueprint(
    "constellation", __name__, url_prefix="/constellation", static_folder="../static"
)
restplus = Api(
    blueprint,
    validate=True,
    decorators=[
        csrf_protect.exempt
    ],  # required, else 400s saying csrf token is missing
    title="Internal restplus endpoints",
    version="1.0",
    description="These are endpoints that use restplus to better document and define contracts. This is not a user-facing interface.",
)
restplus.errorhandler(Exception)(restplus_handle_exception)
log = logging.getLogger(__name__)

# The Constellation page no longer exists; however, Constellation data and the graph functions below are used to load the Celfie data
# for GenePageTabs
@blueprint.route("/")
def view_constellation():
    abort(404)


def _make_network_graph(
    features: pd.DataFrame,
    similarity_df: pd.DataFrame,
    connectivity: ConnectivityOption,
    is_depmap_cor: bool,
):
    """Returns a list of nodes with coordinates and a list of edges with orphan features removed."""

    feature_to_index = {row["feature"]: i for i, row in features.iterrows()}
    # filter similarity df which contains relevant edge connections
    df = similarity_df[
        (similarity_df["v1"].isin(feature_to_index))
        & (similarity_df["v2"].isin(feature_to_index))
        & (similarity_df["weight"] > 0)
        & (similarity_df["set"] <= connectivity.value)
    ]
    # if similarity is depmap correlations, filter by feature and dataset
    if is_depmap_cor:
        # extract the feature dataset from vectorId with format: slice/{dataset}/{entity_id}/entity_id
        features["dataset"] = features.vectorId.apply(
            lambda x: InteractiveTree.get_dataset_feature_from_id(x)[0]
        )
        # combine dataset and feature which will be used as unique ids to filter similarity_df by
        features["dataset_feature"] = features["dataset"] + "|" + features["feature"]
        df = df[
            (df.v1_id.isin(features["dataset_feature"]))
            & (df.v2_id.isin(features["dataset_feature"]))
        ]
        # Since features df used to make nodes and not deduplicated, need to filter to ensure only
        # unique dataset|feature features are included from similarity_df
        features = features[
            (features["dataset_feature"].isin(df["v1_id"]))
            | (features["dataset_feature"].isin(df["v2_id"]))
        ]

    should_label = set(df["v1"].append(df["v2"]))
    # Filter to remove orphan feature (feature nodes without edges)
    features = features[features["feature"].isin(should_label)]
    # Make sure to reset index since igraph vertices are based on index
    features = features.reset_index(drop=True)
    features.reset_index(drop=True, col_level=1)
    # If depmap correlation, use dataset|feature unique id to distinguish feature node to connect by
    if is_depmap_cor:
        feature_to_index = {row["dataset_feature"]: i for i, row in features.iterrows()}
        edges = [
            {"from": row["v1_id"], "to": row["v2_id"], "weight": row["weight"],}
            for _, row in df.iterrows()
        ]
    else:
        feature_to_index = {row["feature"]: i for i, row in features.iterrows()}
        edges = [
            {"from": row["v1"], "to": row["v2"], "weight": row["weight"],}
            for _, row in df.iterrows()
        ]

    graph = igraph.Graph()
    graph.add_vertices(features.shape[0])
    graph.add_edges(
        [
            (feature_to_index[edge["from"]], feature_to_index[edge["to"]])
            for edge in edges
        ]
    )
    graph.es["weight"] = [1 / edge["weight"] for edge in edges]
    layout = graph.layout_fruchterman_reingold(weights="weight")

    # Make sure there are no nan/none values as they shouldn't be plotted
    assert (
        not features.isnull().values.any()
    ), "Any nan values in effect or log should have been filtered. Check dataframe if otherwise"

    # Adjust the weights for frontend graph visualization
    edges_adjusted_weights = [
        {"from": edge["from"], "to": edge["to"], "weight": edge["weight"] * 3,}
        for edge in edges
    ]

    network_graph = {
        "nodes": [
            {
                "id": row["feature"] if not is_depmap_cor else row["dataset_feature"],
                "feature": row["feature"],
                "task": row["task"] if "task" in row else None,
                "x": layout.coords[i][0],
                "y": layout.coords[i][1],
                "effect": row["effect"],
                "-log10(P)": row["-log10(P)"],
                "gene_sets": row["gene_sets"],
                "should_label": row["feature"] in should_label,
            }
            for i, row in features.iterrows()
        ],
        "edges": edges_adjusted_weights,
    }
    return network_graph


def make_network_graph(
    features: pd.DataFrame,
    similarity_measure: SimilarityOption,
    connectivity: ConnectivityOption,
    is_depmap_cor: bool,
):
    """Returns a list of nodes with coordinates and a list of edges."""

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    df = pd.read_csv(os.path.join(source_dir, similarity_measure.file))
    return _make_network_graph(features, df, connectivity, is_depmap_cor)


def _get_graph_definitions(
    input_table: pd.DataFrame,
    n_features: int,
    similarity_measure: SimilarityOption,
    connectivity: ConnectivityOption,
    top_selected_feature: TopFeatureEnum,
):

    df = rename_columns(input_table)

    df = df.dropna()
    df = df.astype({"feature": str, "effect": float, "-log10(P)": float})
    # table is used only in constellation, and is supposed to show you the full input table
    # (all the rows, not just the top features and including duplications for celfie instance)
    graph_definitions = {"table": json.loads(df.to_json(orient="records"))}
    gene_sets = read_genesets(
        os.path.join(current_app.config["WEBAPP_DATA_DIR"], GENE_SETS_FILE), ","
    )
    # Depmap correlations is a special case
    is_depmap_cor = similarity_measure is SimilarityOption.depmap_cor
    features = select_n_features(df, n_features, top_selected_feature, is_depmap_cor)
    features["gene_sets"] = [
        [gene_set.term for gene_set in gene_sets if row["feature"] in gene_set.genes]
        for i, row in features.iterrows()
    ]
    graph_definitions["network"] = make_network_graph(
        features, similarity_measure, connectivity, is_depmap_cor
    )

    up_genes, down_genes = calculate_overrepresentation(features, gene_sets)

    add_geneset_positions(up_genes, graph_definitions["network"]["nodes"])
    add_geneset_positions(down_genes, graph_definitions["network"]["nodes"])

    graph_definitions["overrepresentation"] = {
        "gene_sets_up": up_genes.to_dict(orient="list"),
        "gene_sets_down": down_genes.to_dict(orient="list"),
    }
    return graph_definitions


@restplus.route("/graph")
@csrf_protect.exempt
class GetGraphDefinitions(Resource):
    @restplus.doc(
        description="Given the results of some custom analysis, run network and overrepresentation analyses and return those results",
        params=view_models.get_graph_definitions_request_params,
    )
    @restplus.marshal_with(view_models.get_graph_definitions_response)
    def post(self):
        # we shouldn't split this into calling a function. Just doing this for the time being to minimize git differences
        return get_graph_definitions()


def get_graph_definitions():
    if not current_app.config["ENABLED_FEATURES"].constellation_app:
        abort(404)

    upload_file: FileStorage = request.files.get("uploadFile")
    if upload_file is not None:
        try:
            dialect = csv.Sniffer().sniff(upload_file.read(1024).decode("utf-8"))
            upload_file.seek(0)
            input_table = pd.read_csv(upload_file, sep=dialect.delimiter)
        except:
            return make_error(400, "Could not parse file. File must be a CSV or TSV.")
    else:
        task_ids = request.form.get("resultId").split(",")
        task_tables = [
            constellation_utils.get_df_from_task_id(task_id) for task_id in task_ids
        ]
        if all(task_table is None for task_table in task_tables):
            return make_error(404, "Custom Analysis result not found.")
        input_table = pd.concat(task_tables)

    n_features = int(request.form.get("nFeatures"))
    similarity_measure = SimilarityOption.get_by_option_id(
        request.form.get("similarityMeasure")
    )
    connectivity = ConnectivityOption(int(request.form.get("connectivity")))
    top_selected_feature = TopFeatureEnum(request.form.get("topSelectedFeature"))

    try:
        return _get_graph_definitions(
            input_table,
            n_features,
            similarity_measure,
            connectivity,
            top_selected_feature,
        )
    except ValueError as e:
        log.error("Error creating constellation graph: " + str(e))
        return make_error(400, str(e),)
    except Exception as e:
        log.error("Error creating constellation graph: " + str(e))
        return make_error(
            400,
            "Something went wrong. If this problem persists, please contact us at {}".format(
                current_app.config["CONTACT_EMAIL"]
            ),
        )
