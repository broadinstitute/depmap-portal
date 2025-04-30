from depmap.download.views import (
    get_current_release_download_record,
    get_download_records,
    get_release_data,
)
from depmap.settings.download_settings import get_download_list
from typing import Any, Dict
from flask import (
    current_app,
    Blueprint,
    jsonify,
    render_template,
    url_for,
    redirect,
    request,
)
from depmap.download.models import ReleaseTerms
from depmap.download.models import (
    ReleaseType,
    FileSource,
    ReleaseTerms,
    FileType,
)


blueprint = Blueprint(
    "data_page", __name__, url_prefix="/data_page", static_folder="../static",
)


@blueprint.route("/")
def view_data_page():
    release_notes_url = current_app.config.get("RELEASE_NOTES_URL")
    forum_url = current_app.config.get("FORUM_URL")

    if request.args.get("release") == "LATEST_DEPMAP":
        new_args: Dict[str, Any] = dict(**request.args)
        latest = get_download_list()[0]
        new_args["release"] = latest.name

        # Weird workaround for pyright
        tabKey: Any = "tab"
        tabVal: Any = "allData"
        new_args[tabKey] = tabVal

        return redirect(url_for("data_page.view_data_page", **new_args))

    return render_template(
        "data_page/index.html",
        terms_definitions=ReleaseTerms.get_terms_to_text(),
        release_notes_url=release_notes_url,
        forum_url=forum_url,
    )


@blueprint.route("/api/data")
def get_all_data():
    """
    df of type, release, date, description, size, plot
    """
    downloads = get_download_list()

    return jsonify(
        {
            "table": get_download_records(downloads),
            "releaseData": get_release_data(downloads),
            "currentRelease": get_current_release_download_record(downloads),
            "fileType": FileType.get_all_display_names(),
            "releaseType": ReleaseType.get_all_display_names(),
            "source": FileSource.get_all_display_names(),
            "dataUsageUrl": url_for("public.data_usage"),
        }
    )
