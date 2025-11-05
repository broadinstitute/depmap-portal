import dataclasses
import os
from flask import (
    Blueprint,
    render_template,
    current_app,
    jsonify,
    request,
    abort,
    redirect,
    url_for,
    send_file,
)
from sqlalchemy import func
from oauth2client.service_account import ServiceAccountCredentials
from typing import Any, List, Dict, Literal, Tuple, Union
from flask_restplus import Api, Resource, fields

from depmap import data_access
from depmap.download.models import (
    DownloadRelease,
    ReleaseType,
    DownloadFile,
    FileSource,
    ReleaseTerms,
    FileType,
    DmcBucketUrl,
)
from depmap.download.utils import get_download_url
from depmap.taiga_id.utils import get_taiga_url
from depmap.utilities.sign_bucket_url import sign_url
from depmap.extensions import csrf_protect, restplus_handle_exception
from depmap.entity.models import Entity
from depmap.settings.download_settings import get_download_list
import markdown
from depmap.utilities.data_access_log import log_download_file_access


blueprint = Blueprint(
    "download", __name__, url_prefix="/download", static_folder="../static"
)

restplus = Api(
    blueprint,
    validate=True,
    decorators=[csrf_protect.exempt],  # this is needed for this particular endpoint
    title="Internal restplus endpoints",
    version="1.0",
    description="These are endpoints that use restplus to better document and define contracts. This is not a user-facing interface.",
)
restplus.errorhandler(Exception)(restplus_handle_exception)


def _redirect_to_new_data_page(tab: str = "allData"):
    new_args: Dict[str, Any] = dict(**request.args)
    if request.args.get("release") == "LATEST_DEPMAP":
        latest = _get_latest_release(get_download_list())
        new_args["release"] = latest.name

    # Weird workaround for pyright
    tabKey: Any = "tab"
    tabVal: Any = tab
    new_args[tabKey] = tabVal

    return redirect(url_for("data_page.view_data_page", **new_args))


@blueprint.route("/custom/")
def custom_download():
    return _redirect_to_new_data_page(tab="customDownloads")


@blueprint.route("/")
def download_base_url():
    return _redirect_to_new_data_page()


@blueprint.route("/all/")
def view_all():
    return _redirect_to_new_data_page()


@blueprint.route("/api/downloads")
def get_all_downloads():
    """
    df of type, release, date, description, size, plot
    """
    downloads = get_download_list()

    return jsonify(
        {
            "table": get_download_records(downloads),
            "releaseData": get_release_data(downloads),
            "fileType": FileType.get_all_display_names(),  # the following three provide info for the checkboxes
            "releaseType": ReleaseType.get_all_display_names(),
            "source": FileSource.get_all_display_names(),
            "dataUsageUrl": url_for("public.data_usage"),
        }
    )


def _get_latest_release(downloads: List[DownloadRelease]):
    # assume that the first release is the latest DepMap release because we always add it to the
    # top of the list so it shows up first. We can replace this heuristic if it doesn't work out.
    latest_depmap_release = downloads[0]
    return latest_depmap_release


def get_release_data(downloads: List[DownloadRelease]) -> List[Dict[str, Any]]:
    latest_depmap_release = _get_latest_release(downloads)
    return [
        get_release_record(release, latest_depmap_release == release)
        for release in downloads
    ]


def get_download_records(downloads: List[DownloadRelease]):
    """
    Outside this we gather the records for all the DownloadRelease objects, then make a df
    Makes more sense to concat lists than to concat a df
    :return:
    """
    return [
        get_file_record(release, file)
        for release in downloads
        for file in release.all_files
    ]


def get_current_release_download_record(downloads: List[DownloadRelease]):
    # There is established precedence for assuming the first download is the current release
    release = downloads[0]
    return [get_file_record(release, file) for file in release.all_files]


def get_release_record(release: DownloadRelease, is_latest):
    return {
        "releaseName": release.name,
        "releaseGroup": release.group,
        "releaseVersionGroup": release.version_group,
        "releaseType": release.type.display_name,
        "description": release.description,
        "citation": release.citation,
        "funding": release.funding,
        "isLatest": is_latest,
    }


def get_file_record(release: DownloadRelease, f: DownloadFile):
    file_record = {
        "sources": f.get_sources_display_names(),
        "fileName": f.name,
        "fileType": f.type.display_name,
        "size": f.size,
        "version": f.version,
        "pipeline": None
        if not f.pipeline_name
        or not release.pipelines
        or (f.pipeline_name not in release.pipelines.keys())
        else {
            "name": f.pipeline_name,
            "description": markdown.markdown(release.pipelines[f.pipeline_name]),
        },
        "fileDescription": None
        if f.description is None
        else markdown.markdown(f.description),
        "isMainFile": f.is_main_file,
        "retractionOverride": f.retraction_override,
        "downloadUrl": f.url,
        "taigaUrl": get_taiga_url(f.original_taiga_id) if f.original_taiga_id else None,
        "releaseName": release.name,
        "terms": release.get_terms(f).value,
        "date": release.get_release_date(f).strftime("%m/%y"),
    }

    if f.sub_type is not None:
        file_record["fileSubType"] = dataclasses.asdict(f.sub_type)

    if f.summary_stats is not None:
        file_record["summaryStats"] = f.summary_stats.stats

    return file_record


# keeping this endpoint so we can use it in dmc templates for the time being
@blueprint.route("/api/download/dmc")
def download_dmc_file():
    file_name = request.args.get("file_name")
    return redirect(
        url_for(
            "download.download_file", file_name=file_name, bucket=DmcBucketUrl.BUCKET
        )
    )


@blueprint.route("/api/download")
def download_file():
    file_name = request.args.get("file_name")
    dl_name = request.args.get("dl_name")
    bucket = request.args.get("bucket")
    downloads = get_download_list()

    if is_valid_download_file(downloads, bucket, file_name):
        credentials = ServiceAccountCredentials.from_json_keyfile_name(
            current_app.config["DOWNLOADS_KEY"]
        )

        url = sign_url(credentials, bucket, file_name, dl_name=dl_name)
        log_download_file_access("download_file", file_name)
        return redirect(url)
    else:
        abort(404)


additional_dmc_files = {
    (DmcBucketUrl.BUCKET, "dmc-resources/dmc-portal-101.mp4"),
    (DmcBucketUrl.BUCKET, "dmc-resources/scatterplots.mp4"),
    (DmcBucketUrl.BUCKET, "dmc-resources/violinplots.mp4"),
    (DmcBucketUrl.BUCKET, "dmc-resources/2019-symposium/DMC_Symposium_2019_Slides.pdf"),
}


def is_valid_download_file(downloads, bucket, file_name):
    gs_path = (bucket, file_name)
    if gs_path in additional_dmc_files:
        return True
    for download in downloads:
        if gs_path in download.google_storage_locations:
            return True
    return False


@blueprint.route("/citationUrl")
def get_morpheus_url():
    dataset_id = request.args.get("dataset_id")
    taiga_id = data_access.get_dataset_taiga_id(dataset_id)
    download_url = get_download_url(taiga_id) if taiga_id else None
    return jsonify(download_url)


@blueprint.route("/data_slicer/download")
def data_slicer_download():
    """
    Endpoint to download a file produced by data slicer
    Takes the following query params
    :param file_path: file path from the results root dir
    :param name: nice display name that the file should be downloaded as

    The query params for this endpoint are specifically named to satisfy morpheus.
    If you are modifying the query params/the the contract of their values, please read and understand the following

        Morpheus wants to get the filename from the endpoint url it hits to download the file.
            One of the modes it does so is to check whether the query param "file" or "name" is present
            https://github.com/cmap/morpheus.js/blob/6ba908ddd651b5d3f80b1270969256bd5ada8006/src/util/util.js#L249
        From that filename it wants to retrieve an extension, in our case specifically a csv
            https://github.com/cmap/morpheus.js/blob/6ba908ddd651b5d3f80b1270969256bd5ada8006/src/util/util.js#L299
        To satisfy these conditions of morpheus, we
            - name one of the query parameters "name". for the purposes of this endpoint (not just morpheus), this is also the actual file name to show to the user
            - the value of the "name" query param ends with .csv
            - do not name the other query parameter "file"
    """
    filename_for_user = request.args.get(
        "name"
    )  # this args MUST be named "name". the value needs to end with .csv. see docstring
    file_path_from_compute_results_dir = request.args.get(
        "file_path"
    )  # there should not also be args named "file"

    full_file_path = os.path.join(
        current_app.config["COMPUTE_RESULTS_ROOT"], file_path_from_compute_results_dir
    )

    return send_file(
        full_file_path,
        mimetype="text/csv",
        as_attachment=True,
        attachment_filename=filename_for_user,
    )


@restplus.route("/data_slicer/validate_features")
class ValidateFeatures(Resource):
    @restplus.marshal_with(
        restplus.model(
            "ValidatedFeatures",
            {
                "valid": fields.List(
                    fields.String(
                        description="Case (upper/lower)-corrected labels of features that are entity labels (presumably exist in at least one dataset)"
                    )
                ),
                "invalid": fields.List(
                    fields.String(
                        description="Provided labels that are not entity labels (therefore don't exist in any dataset)"
                    )
                ),
            },
        ),
    )
    @restplus.doc(
        description="Validate whether or not given features are valid entity labels",
        params={
            "featureLabels": {
                "description": "Case-insensitive labels of features to validate",
                "type": "list",
            },
        },
    )
    def post(self):
        entity_labels = request.json.get("featureLabels")
        assert entity_labels is not None
        return validate_features(entity_labels)


def validate_features(entity_labels):
    """
    :param entity_labels: A list of case-insensitive entity labels
    :return: A dictionary with the following keys
        "valid": A list of correctly-cased valid labels
        "invalid": A list of invalid labels
    """
    lowercase_input_labels = [label.lower() for label in entity_labels]
    query = Entity.query.filter(func.lower(Entity.label).in_(lowercase_input_labels))
    result = query.all()

    valid_feature_labels = [res.label for res in result]
    lowercase_valid_feature_labels = [label.lower() for label in valid_feature_labels]

    invalid_feature_labels = [
        entity
        for entity in entity_labels
        if entity.lower() not in lowercase_valid_feature_labels
    ]
    return {"valid": valid_feature_labels, "invalid": invalid_feature_labels}
