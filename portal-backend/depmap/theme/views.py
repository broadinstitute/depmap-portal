import os
from flask import Blueprint, send_from_directory, current_app
from typing import cast, Dict, Any

blueprint = Blueprint("theme", __name__, url_prefix="/theme",)


@blueprint.route("/static/<path:filename>")
def static(filename):
    config: Dict[str, Any] = cast(Dict[str, Any], current_app.config)
    theme_static_dir = os.path.abspath(os.path.join(config["THEME_PATH"], "static"))
    return send_from_directory(theme_static_dir, filename)
