from flask import (
    Blueprint,
    current_app,
    render_template,
    abort,
    safe_join,
)

import pandas as pd

from depmap.enums import DependencyEnum

from pandera import Column, DataFrameSchema
from depmap.utilities import json_dump

schema = DataFrameSchema(
    {
        "BroadID": Column("string", unique=True),
        "Name": Column("string"),
        "PearsonScore": Column("Float64"),
        "BimodalityCoefficient": Column("Float64"),
        "ModelType": Column("string", nullable=True),
        "TopBiomarker": Column("string", nullable=True),
        "NumberOfSensitiveLines": Column("Int64"),
        "Dose": Column("string", nullable=True),
        "Target": Column("string", nullable=True),
        "TargetOrMechanism": Column("string", nullable=True),
        "Synonyms": Column("string", nullable=True),
    },
    strict=True,
    coerce=True,
)


blueprint = Blueprint(
    "compound_dashboard",
    __name__,
    url_prefix="/compound_dashboard",
    static_folder="../static",
)


@blueprint.route("/")
def view_compound_dashboard():
    if not current_app.config["ENABLED_FEATURES"].compound_dashboard_app:
        abort(404)

    return render_template("compound_dashboard/index.html")


def format_summary_as_json(path):
    compound_summary = pd.read_csv(path)
    compound_summary = compound_summary[~pd.isna(compound_summary["Name"])]

    return json_dump.jsonify_df(compound_summary, schema)


def get_compound_summary_csv_path(name: DependencyEnum):
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    dest_path = safe_join(source_dir, "compound_summary", f"{name.name}.csv")
    return dest_path


@blueprint.route("summary_table/<name>")
def get_compound_dashboard_summary_table(name):
    if not current_app.config["ENABLED_FEATURES"].compound_dashboard_app:
        abort(404)

    path = get_compound_summary_csv_path(DependencyEnum(name))
    return format_summary_as_json(path)
