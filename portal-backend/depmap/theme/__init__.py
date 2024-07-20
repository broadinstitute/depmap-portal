import os
import markupsafe
from flask import render_template_string, current_app
from typing import Dict, Any, cast

# Methods for fetching/applying templates which are configured per environment


def render_theme_template(path, **kwargs):
    config: Dict[str, Any] = cast(Dict[str, Any], current_app.config)
    full_path = os.path.abspath(os.path.join(config["THEME_PATH"], path))
    with open(full_path, "rt") as fd:
        template_string = fd.read()
    return markupsafe.Markup(render_template_string(template_string, **kwargs))


def include_theme_snippet(name):
    return render_theme_template(name)
