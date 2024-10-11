"""Views for the Celligner tool."""
import io
import json
import os
import zipfile

import numpy as np
import pandas as pd
from flask import Blueprint, current_app, jsonify, render_template, request, send_file
from flask_restplus import Api, Resource, fields

from depmap.celligner.models import (
    CellignerDistanceColIndex,
    CellignerDistanceRowIndex,
    TUMOR_TYPES,
)
from depmap.context.models import Lineage
from depmap.extensions import restplus_handle_exception
from depmap.utilities import hdf5_utils
from depmap.utilities.sign_bucket_url import get_signed_url
from loader.celligner_loader import (
    ALIGNMENT_FILE,
    DIR,
    DISTANCES_FILE,
    DISTANCES_FILE_FOR_DOWNLOAD,
    SUBTYPES_FILE,
)

blueprint = Blueprint(
    "celligner", __name__, url_prefix="/celligner", static_folder="../static"
)

restplus = Api(
    blueprint,
    validate=True,
    title="Internal restplus endpoints",
    version="1.0",
    description="These are endpoints that use restplus to better document and define contracts. This is not a user-facing interface.",
)
restplus.errorhandler(Exception)(restplus_handle_exception)


def _flatten_subtype_lists(grp):
    subtypes = sorted(list(grp))
    if "all" in subtypes:
        subtypes.remove("all")
        subtypes.insert(0, "all")
    return subtypes


def _format_alignments(alignment: pd.DataFrame):
    return {
        "profileId": alignment["profileId"].values.tolist(),
        "modelConditionId": alignment["modelConditionId"].values.tolist(),
        # sampleId could be a model or a tumor id
        "sampleId": alignment["sampleId"].values.tolist(),
        "displayName": alignment["displayName"].values.tolist(),
        "modelLoaded": alignment["modelLoaded"].values.tolist(),
        "umap1": alignment["umap1"].values.tolist(),
        "umap2": alignment["umap2"].values.tolist(),
        "lineage": alignment["lineage"].values.tolist(),
        "subtype": alignment["subtype"].values.tolist(),
        "primaryMet": alignment["primaryMet"].values.tolist(),
        "type": alignment["type"].values.tolist(),
        "cluster": alignment["cluster"].values.tolist(),
        "growthPattern": alignment["growthPattern"].values.tolist(),
    }


@blueprint.route("/")
def view_celligner():
    """Entry point for Celligner plot"""
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, DIR, ALIGNMENT_FILE)
    celligner_alignment = pd.read_csv(
        path,
        dtype={
            "profileId": str,
            "modelConditionId": str,
            "sampleId": str,
            "displayName": str,
            "modelLoaded": bool,
            "umap1": float,
            "umap2": float,
            "lineage": str,
            "subtype": str,
            "type": str,
            "cluster": int,
            "primaryMet": str,
            "growthPattern": str,
        },
    )

    celligner_alignment = celligner_alignment.where(
        pd.notnull(celligner_alignment), None
    )

    path = os.path.join(source_dir, DIR, SUBTYPES_FILE)
    celligner_subtypes = pd.read_csv(path)
    celligner_subtypes = celligner_subtypes.groupby(["lineage"])["subtype"].apply(
        _flatten_subtype_lists
    )

    methodology_url = get_signed_url(
        "shared-portal-files", "Tools/Celligner_documentation.pdf"
    )

    return render_template(
        "celligner/index.html",
        alignments=json.dumps(_format_alignments(celligner_alignment)),
        subtypes=celligner_subtypes.to_json(),
        methodology_url=methodology_url,
    )


@blueprint.route("/distance_cell_line_to_tumors")
def celligner_distance_cell_line_to_tumors():
    sample_id = request.args["sampleId"]
    k_neighbors = int(request.args["kNeighbors"])

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, DIR, ALIGNMENT_FILE)
    celligner_alignment = pd.read_csv(path)

    col_index = CellignerDistanceColIndex.get_by_sample_id(sample_id)
    col = np.array(
        hdf5_utils.get_col_of_values(
            os.path.join(source_dir, DIR), DISTANCES_FILE, col_index.index
        )
    )
    top_k_indexes = np.argsort(col)[:k_neighbors].tolist()
    top_k_row_indexes = CellignerDistanceRowIndex.get_by_indexes(top_k_indexes)
    top_k_lineages = celligner_alignment[
        celligner_alignment["sampleId"].isin(
            [row_index.tumor_sample_id for row_index in top_k_row_indexes]
        )
    ].lineage
    top_lineage = top_k_lineages.mode().iloc[0]
    return jsonify(
        {
            "distance_to_tumors": col.tolist(),
            "most_common_lineage": top_lineage,
            "color_indexes": top_k_indexes,
        }
    )


@blueprint.route("/distance_tumors_to_cell_lines")
def celligner_distance_tumors_to_cell_lines():
    lineage = request.args["primarySite"]
    subtype = request.args["subtype"]
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, DIR, ALIGNMENT_FILE)
    celligner_alignment = pd.read_csv(path)

    if subtype == "all":
        tumors = celligner_alignment[
            (celligner_alignment["type"].isin(TUMOR_TYPES))
            & (celligner_alignment["lineage"].str.lower() == lineage.lower())
        ]
    else:
        tumors = celligner_alignment[
            celligner_alignment["type"].isin(TUMOR_TYPES)
            & (celligner_alignment["lineage"].str.lower() == lineage.lower())
            & (celligner_alignment["subtype"].str.lower() == subtype.lower())
        ]

    if tumors.empty:
        response = {"medianDistances": None}
        return jsonify(response)

    row_indexes = CellignerDistanceRowIndex.get_by_tumor_sample_ids(
        tumors["sampleId"].values
    )

    median_distances = np.median(
        [
            hdf5_utils.get_row_of_values(  # Data access details should be in interactive config
                os.path.join(source_dir, DIR), DISTANCES_FILE, row_index.index
            )
            for row_index in row_indexes
        ],
        axis=0,
    )
    response = {"medianDistances": median_distances.tolist()}
    return jsonify(response)


@blueprint.route("/download_files")
def download_celligner_files():
    source_dir = current_app.config["WEBAPP_DATA_DIR"]

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w") as zf:
        zf.write(os.path.join(source_dir, DIR, ALIGNMENT_FILE), arcname=ALIGNMENT_FILE)
        zf.write(
            os.path.join(source_dir, DIR, DISTANCES_FILE_FOR_DOWNLOAD),
            arcname=DISTANCES_FILE_FOR_DOWNLOAD,
        )

    memory_file.seek(0)

    return send_file(
        memory_file, attachment_filename="celligner.zip", as_attachment=True
    )


CellLineSelectorColorMap = restplus.model(
    "CellLineSelectorColorMap",
    {
        "primaryDisease": fields.List(fields.String),
        "lineage": fields.List(fields.String),
        "color": fields.List(fields.String),
    },
)


# this endpoint is used by cell line SELECTOR, ** not ** celligner
@restplus.route("/colors")
class CellLineSelectorColors(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the class name
    @restplus.doc(
        description="Fetches a map from lineages and primary disease to celligner colors. This was originally used "
        "by celligner but now appears to only be used by cell line selector"
    )
    @restplus.marshal_with(CellLineSelectorColorMap)
    def get(self):
        return get_cell_line_selector_colors()


def get_cell_line_selector_colors():
    colors = []
    diseases = []
    lineages = []
    with open("sample_data/celligner_disease_color_map.json") as f:
        file = json.load(f)
        for row in file:
            colors.append(row["Celligner color"])
            diseases.append(row["Primary disease depmap"])
            lineages.append(Lineage.get_display_name(row["lineage depmap"]))
    return {"primaryDisease": diseases, "lineage": lineages, "color": colors}
