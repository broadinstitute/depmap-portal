from flask import Blueprint, current_app, render_template, abort
from logging import getLogger

log = getLogger(__name__)

blueprint = Blueprint(
    "external_tools", __name__, url_prefix="/external_tools", static_folder="../static",
)


@blueprint.route("/<app_id>")
def view_external_tool(app_id: str):
    if "EXTERNAL_TOOLS" not in current_app.config:
        abort(404)

    EXTERNAL_TOOLS = current_app.config["EXTERNAL_TOOLS"]

    if app_id not in EXTERNAL_TOOLS:
        abort(404)

    data = EXTERNAL_TOOLS[app_id]

    if "title" not in data:
        log.error(
            f'You must define a title for external tool "{app_id}". Check EXTERNAL_TOOLS in app config.'
        )
        abort(500)

    if "url" not in data:
        log.error(
            f'You must define a url for external tool "{app_id}". Check EXTERNAL_TOOLS in app config.'
        )
        abort(500)

    title = data["title"]
    url = data["url"]
    description = data["description"] if "description" in data else ""

    if not url.startswith("http"):
        url = "https://" + url

    if "streamlitapp" in url:
        url += "?embedded=true"

    return render_template(
        "external_tools/index.html", title=title, description=description, url=url,
    )
