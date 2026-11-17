from flask import (
    current_app,
    Blueprint,
    render_template,
)
from depmap.download.models import ReleaseTerms
from depmap.download.models import ReleaseTerms


blueprint = Blueprint(
    "data_page_v2", __name__, url_prefix="/data_page_v2", static_folder="../static",
)


@blueprint.route("/")
def view_data_page_v2():
    release_notes_url = current_app.config.get("RELEASE_NOTES_URL")
    forum_url = current_app.config.get("FORUM_URL")

    return render_template(
        "data_page_v2/index.html",
        terms_definitions=ReleaseTerms.get_terms_to_text(),
        release_notes_url=release_notes_url,
        forum_url=forum_url,
    )
