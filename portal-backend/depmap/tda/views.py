import numpy as np
import pandas as pd
import os
import tempfile
from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
)
from graphviz import Source

from depmap.tda.models import TDAInterpretableModel

TDA_SUMMARY_FILE = "full_tda_summary.csv"

blueprint = Blueprint("tda", __name__, url_prefix="/tda", static_folder="../static")

COMMON_COLUMNS = {
    "symbol": str,
}

SCREEN_SPECIFIC_COLUMNS = {
    "depCL_frac": float,
    "min_gene_effect": float,
    "min_gene_effect_zscore": float,
    "Variance": float,
    "Skewness": float,
    "PanDependency": bool,
    "LRT": float,
    "Predictive_Accuracy": float,
    "Mean": float,
    "strong_depCL_count": int,
}


def get_expected_columns_in_tda_table():
    columns = set(COMMON_COLUMNS.keys())
    for column in SCREEN_SPECIFIC_COLUMNS.keys():
        for screen in {"CRISPR", "RNAi"}:
            columns.add("{}_{}".format(screen, column))
    return columns


def convert_series_to_json_safe_list(s, dtype=str):
    if dtype == float:
        return [x if np.isfinite(x) else None for x in s]
    elif dtype == bool:
        return [str(x) if type(x) == bool else None for x in s]
    elif dtype == int:
        return [int(x) if np.isfinite(x) else None for x in s]
    else:
        return [str(x) if type(x) == str else None for x in s]


@blueprint.route("/")
def view_tda_summary():
    if not current_app.config["ENABLED_FEATURES"].target_discovery_app:
        abort(404)

    return render_template("tda/index.html")


@blueprint.route("/v2/")
def view_tda_summary_v2():
    return redirect("../")


@blueprint.route("/v3/")
def view_tda_summary_v3():
    return redirect("../")


@blueprint.route("summary_table")
def get_tda_summary_table():
    if not current_app.config["ENABLED_FEATURES"].target_discovery_app:
        abort(404)

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, TDA_SUMMARY_FILE)
    tda_summary = pd.read_csv(path, dtype={"entrez_id": str})
    tda_summary = tda_summary[tda_summary["symbol"].notna()]

    data = {
        column: convert_series_to_json_safe_list(tda_summary[column], dtype=dtype)
        for column, dtype in COMMON_COLUMNS.items()
    }
    for column, dtype in SCREEN_SPECIFIC_COLUMNS.items():
        for screen in {"CRISPR", "RNAi"}:
            column_name = "{}_{}".format(screen, column)
            data[column_name] = convert_series_to_json_safe_list(
                tda_summary[column_name], dtype=dtype
            )
    return jsonify(data)


@blueprint.route("interpretable_model")
def get_interpretable_model_for_gene_and_dataset():
    if not current_app.config["ENABLED_FEATURES"].target_discovery_app:
        abort(404)

    interpretable_model = TDAInterpretableModel.get_by_gene_label_and_dataset_name(
        request.args.get("gene_label"), request.args.get("dataset")
    )

    if not interpretable_model:
        return jsonify(None)

    s = Source(interpretable_model.dot_graph)
    with tempfile.NamedTemporaryFile(
        dir=current_app.config["WEBAPP_DATA_DIR"]
    ) as temp_img:
        s.render(temp_img.name, format="png")
    return send_file(temp_img.name + ".png", mimetype="image/png")


@blueprint.route("table_download")
def get_tda_table_download():
    if not current_app.config["ENABLED_FEATURES"].target_discovery_app:
        abort(404)

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, TDA_SUMMARY_FILE)
    return send_file(
        path,
        mimetype="text/csv",
        attachment_filename=TDA_SUMMARY_FILE,
        as_attachment=True,
    )
