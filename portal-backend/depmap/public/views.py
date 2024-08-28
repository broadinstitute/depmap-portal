# -*- coding: utf-8 -*-
"""For root-level pages, including internal-only skyros pages."""
import logging
import os
import re
from depmap.extensions import cache_without_user_permissions
from depmap.download.views import _get_latest_release
from depmap.public.fetch_forum_resources import pull_resource_topics_from_forum
from depmap.public.resources import (
    get_root_category_subcategory_topics,
    create_sanitizer,
    refresh_all_category_topics,
    _read_forum_api_key,
)
from depmap.discourse.client import DiscourseClient
from depmap.settings.download_settings import get_download_list
from itsdangerous import URLSafeSerializer
from depmap.utilities.sign_bucket_url import sign_url
import urllib.parse
from oauth2client.service_account import ServiceAccountCredentials

from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    render_template,
    render_template_string,
    request,
    url_for,
    redirect,
)
import requests
from depmap.public.parse_resources import parse_resources_file

from depmap.public.announcements.utils import get_announcements_list

from .documentation import rewrite_documentation_urls


log = logging.getLogger(__name__)

blueprint = Blueprint("public", __name__, static_folder="../static")
from depmap.theme import include_theme_snippet, render_theme_template


@blueprint.route("/simulate-error", methods=["GET", "POST"])
def simulate_error():
    """Home page."""
    if "exception" in request.args:
        raise Exception("Test exception: {}".format(request.args["exception"]))
    if "logerror" in request.args:
        msg = request.args["logerror"]
        log.error("Test error: {}".format(msg))
        return "Logged error: {}".format(msg)
    return """Endpoint for testing errors and exceptions. \nAdd 'exception=...' to raise a test exception, or 'logerror=...' to log a test error message"""


@blueprint.route("/")
def home():
    latest = _get_latest_release(get_download_list())
    m = re.match(".*(2\dQ\d)", latest.name)

    if m:
        quarter_name = m.groups()[0]
    else:
        quarter_name = None
    return render_theme_template(
        "home.html",
        announcements=get_announcements_list(),
        quarter=quarter_name,  # , DEPMAP_URL=url_prefix
    )


@blueprint.route("/contact/")
def contact():
    return render_theme_template("contact.html")


@blueprint.route("/privacy/")
def privacy():
    return render_template("public/privacy.html")


@blueprint.route("/terms/")
def terms():
    return render_theme_template(
        "terms.html", terms=include_theme_snippet(name="terms_and_conditions_text.html")
    )


@blueprint.route("/terms_text")
def terms_text():
    return jsonify(render_theme_template("terms_and_conditions_text.html"))


@blueprint.route("/feedbackUrlRoot")
def get_feedback_url_root():
    return jsonify(current_app.config["FEEDBACK_FORM_URL"])


@blueprint.route("/morpheusUrl")
def get_morpheus_url():
    csv_url = request.args.get("csv_url")
    return jsonify(url_for("experimental.morpheus_data_slicer", csv_url=csv_url))


# NOTE: This is a prototype, so this route should not be accessible anywhere in the portal UI
@blueprint.route("/documentation_prototype/")
def documentation_prototype():
    forum_api_key_value = current_app.config.get("FORUM_API_KEY")
    if forum_api_key_value is None:
        abort(404)

    if os.path.isfile(
        forum_api_key_value
    ):  # Presumably value is filepath in dev config only
        with open(forum_api_key_value) as fp:
            discourse_api_key = fp.read()
    else:
        discourse_api_key = forum_api_key_value

    if not discourse_api_key:
        abort(404)

    assert isinstance(discourse_api_key, str)

    topics = pull_resource_topics_from_forum(discourse_api_key)

    return render_template("public/documentation_prototype.html", topics=topics)


@blueprint.route("/documentation/")
def documentation():
    documentation_path = current_app.config["DOCUMENTATION_PATH"]
    if not documentation_path:
        abort(404)

    if os.path.exists(documentation_path):
        sections = parse_resources_file(documentation_path)
    else:
        sections = []

    sections = rewrite_documentation_urls(sections)
    return render_template("public/documentation.html", sections=sections)


@blueprint.route("/resources/reload")
def resources_reloads():
    forum_api_key_value = current_app.config.get("FORUM_API_KEY")
    forum_url = current_app.config.get("FORUM_URL")
    resources_data_path = current_app.config.get("RESOURCES_DATA_PATH")

    if forum_api_key_value is None or forum_url is None or resources_data_path is None:
        abort(404)

    discourse_api_key = _read_forum_api_key(forum_api_key_value)

    client = DiscourseClient(discourse_api_key, forum_url, resources_data_path, True)
    try:
        refresh_all_category_topics(
            client, current_app.config.get("FORUM_RESOURCES_CATEGORY")
        )
    except requests.exceptions.HTTPError as err:
        if err.response.status_code == 429:
            abort(429)
        else:
            raise err
    return render_template("public/resources_reload.html")


@blueprint.route("/resources_prototype/")
def resources_prototype():
    forum_api_key_value = current_app.config.get("FORUM_API_KEY")
    forum_url = current_app.config.get("FORUM_URL")
    resources_data_path = current_app.config.get("RESOURCES_DATA_PATH")

    if forum_api_key_value is None or forum_url is None or resources_data_path is None:
        abort(404)

    discourse_api_key = _read_forum_api_key(forum_api_key_value)

    client = DiscourseClient(discourse_api_key, forum_url, resources_data_path)
    sanitizer = create_sanitizer()

    try:
        root_category = get_root_category_subcategory_topics(
            client, sanitizer, current_app.config.get("FORUM_RESOURCES_CATEGORY")
        )
    except requests.exceptions.HTTPError as err:
        if err.response.status_code == 429:
            abort(429)
        else:
            raise err
    if root_category is None:
        abort(404)

    assert root_category

    return render_template(
        "public/resources_prototype.html", root_category=root_category,
    )


# DMC Only
@blueprint.route("/dmc_symposia/")
def dmc_symposia():
    if not current_app.config["ENABLED_FEATURES"].extra_dmc_pages:
        abort(404)

    documentation_path = current_app.config["DMC_SYMPOSIA_PATH"]

    if os.path.exists(documentation_path):
        sections = parse_resources_file(documentation_path)
    else:
        sections = []

    sections = rewrite_documentation_urls(sections)
    return render_theme_template("dmc_symposia.html", sections=sections)


@blueprint.route("/flagship_projects/")
def flagship_projects():

    if not current_app.config["ENABLED_FEATURES"].flagship_projects:
        abort(404)
    return render_theme_template("flagship_projects.html")


@blueprint.route("/data_usage/")
def data_usage():
    if not current_app.config["ENABLED_FEATURES"].data_usage:
        abort(404)
    return render_theme_template("data_usage.html")


@blueprint.route("/cell_line_mapping/")
def cell_line_mapping():
    if not current_app.config["ENABLED_FEATURES"].cell_line_mapping:
        abort(404)
    return render_theme_template("cell_line_mapping.html")


@blueprint.route("/call_for_models/")
def call_for_models():
    return render_template("public/call_for_models.html")


@blueprint.route("/portal_dmc_url")
def portal_dmc_url():
    """
    Verifies if given url is signed by the portal, and redirects to GCS url if it is. Anytime we call this endpoint, a new GCS url is generated and therefore the GCS url returned should not be an expired url
    """
    doclink = request.args.get("doclink")

    try:
        # Deserialize signed url
        secret_key = current_app.config["SECRET_KEY"]  # type: ignore
        bucket, key = URLSafeSerializer(secret_key).loads(doclink)
    except Exception as e:
        raise PermissionError("Resource not verified!") from e

    credentials = ServiceAccountCredentials.from_json_keyfile_name(
        current_app.config["DOWNLOADS_KEY"]
    )
    # We've confirmed url was signed by portal so redirect to generated GCS url
    return redirect(sign_url(credentials, bucket, key))
