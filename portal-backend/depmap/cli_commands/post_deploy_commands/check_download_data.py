from enum import Enum
from json import dumps as json_dumps
import click
import collections
from depmap.taiga_id.utils import check_taiga_datafile_valid
from depmap.utilities.iter_utils import pairwise_with_repeat
from flask import current_app, url_for
from flask.cli import with_appcontext
from depmap.download.models import BucketUrl, DownloadRelease
from depmap.download.views import get_all_downloads
from depmap.dataset.models import Dataset
from depmap.access_control import all_records_visible
from depmap.settings.download_settings import get_download_list

# any added cli_commands need to be registered in app.py


class DownloadIssueType(Enum):
    """
    Helps with testing
    """

    invalid_taiga_id = "Invalid Taiga ID"
    duplicate_taiga_id = "Duplicate Taiga ID"
    duplicate_file_name = "Duplicate File Name(s)"
    duplicate_release_name = "Duplicate Release Name(s)"
    duplicate_url = "Duplicate Url(s)"
    dataset_without_file = "Dataset Without File"
    dataset_file_is_retracted = "Dataset File is Retracted"
    could_not_index_by_taiga_id = "Could Not Index Dataset by Headliner File Taiga"
    public_dataset_without_citation = "Public dataset has no citation"
    fixme_found = "Found a fixme"


class DownloadIssues:
    def __init__(self):
        self.issues = []

    def append(self, type, text):
        """
        This forces addition of an issue type
        And wraps the two into a tuple for us
        """
        self.issues.append((type, text))

    def get_issues_description(self):
        string = "Download data issues detected:\n"
        for type, text in self.issues:
            string += "\n\t{}: {}".format(type.value, text)
        return string


# the cli command here is used in the deploy-data repo, not in depmap
@click.command("check_download_data")
@with_appcontext
def check_download_data():
    with all_records_visible():
        downloads = get_download_list()
        _check_download_data(downloads)


# a white list of historical taiga IDs which were deprecated in the past.
# rather than worry about these right now, we ignore these so that the
# check which validates taiga IDs can only worry about _new_ problems.
KNOWN_DEPRECATED_TAIGA_IDS = {
    "public-20q1-c3b6.13/CCLE_segmented_cn",
    "public-20q1-c3b6.13/README",
    "public-20q1-c3b6.13/sample_info",
    "public-19q4-93d9.20/CCLE_fusions",
    "public-19q4-93d9.20/CCLE_fusions_unfiltered",
    "depmap-rnaseq-expression-data-ccd0.8/CCLE_depMap_18Q4_TPM_ProteinCoding",
    "depmap-rnaseq-expression-data-ccd0.8/CCLE_depMap_18Q4_TPM_transcripts",
    "depmap-mutation-calls-9a1a.3/depmap_18Q3_mutation_calls",
    "depmap-wes-cn-data-97cc.9/public_18Q3_gene_cn",
    "depmap-wes-cn-data-97cc.7/public_18q2_gene_cn",
    "depmap-wes-cn-data-97cc.5/public_18q1_gene_cn",
    "gdsc-drug-set-export-658c.5/SANGER_DOSE_RESPONSE",
    "gdsc-drug-set-export-658c.5/SANGER_VIABILTY",
}

from depmap.enums import BiomarkerEnum

datasets_to_skip_file_check = [
    # we currently don't make these downloadable, however, they should be downloadable via custom downloads
    BiomarkerEnum.context,
    BiomarkerEnum.crispr_confounders,
]


def _check_download_data(downloads: list[DownloadRelease]):
    """
    Used in the deploy-data repo, not in this project
    Separated from the cli command for testing
    It takes a while every time we make a change to push, run tests, build the docker image, run the deploy check
    So we run everything and gather all the errors, then report everything instead of failing quickly
    :param dataset_err_msg_name_and_taiga_id: List of (name, taiga id) tuples. The name is only used to print error messages, and not to look up anything
    """
    dataset_err_msg_name_and_taiga_id = []  # taiga ids are canonical
    for dataset in Dataset.query.all():
        if dataset.name not in datasets_to_skip_file_check:
            dataset_err_msg_name_and_taiga_id.append((dataset.name, dataset.taiga_id))
    # no need to check tabular datasets because:
    # 1. at the moment, we aren't going to have a gene table to download and this is failing
    # 2. we don't generate links to these files
    # 3. this check is of limited value
    # for tabular_dataset in TabularDataset.query.all():
    #     dataset_err_msg_name_and_taiga_id.append(
    #         (tabular_dataset.name, tabular_dataset.taiga_id)
    #     )

    # the BiomarkerEnum.context dataset has historically used one of these as its taiga id
    download_file_startswith_exceptions = {
        "master-cell-line-export-0306",
        "arxspan-cell-line-export-f808",
        # Predictability biomarker matrixes that are available through custom downloads,
        # but are not associated with a Release
        "confounders-f38f.2/demeter2-combined-v12-confounders",
        "primary-screen-e5c7.11/PRISM_REP_PRIMARY_CONF",
        # adding confounders to follow the pattern above
        "repurposing-public-23q2-341f.10/Repurposing_Public_23Q2_Extended_Matrix_Confounders",
        # taiga ids that start with 'derived-data:[uuid]' are created within portal and are not in taiga.
        # They don't necessarily have download files
        "derived-data:",
        # this is a dataset which is getting confused by the "satisfied_by_taiga_id" field
        # not 100% sure what's changed, but as we're moving to BB, hopefully all of this checking code can
        # be deleted soon.
        "rrbs-4b29.7/CCLE_RRBS_TSS1kb_20181022_matrix",
    }

    issues = DownloadIssues()
    taiga_ids, retracted_taiga_ids = _get_canonical_taiga_ids()

    urls = []  # string urls, not taiga urls
    release_name_set = set()

    for release in downloads:
        file_name_set = set()

        for file in release.all_files:
            file_name_set.add(file.name)
            if isinstance(file._url, str):
                urls.append(file._url)
            elif isinstance(file._url, BucketUrl):
                urls.append(file._url.bucket + file._url.file_name)
            # else taigaonly, don't add

            if file.original_taiga_id:
                if not (
                    file.original_taiga_id in KNOWN_DEPRECATED_TAIGA_IDS
                    or check_taiga_datafile_valid(file.original_taiga_id)
                ):
                    issues.append(
                        DownloadIssueType.invalid_taiga_id,
                        "{} with id {}".format(file.name, file.original_taiga_id),
                    )

        if not len(file_name_set) == len(release.all_files):
            all_file_names = [file.name for file in release.all_files]
            issues.append(
                DownloadIssueType.duplicate_file_name,
                "Release {} has duplicate file names: {}".format(
                    release.name,
                    {
                        "{} with {} duplicates".format(name, all_file_names.count(name))
                        for name in all_file_names
                        if all_file_names.count(name) > 1
                    },
                ),
            )

        if (
            current_app.config["ENABLED_FEATURES"].require_download_citations
            and release.citation is None
        ):
            issues.append(
                DownloadIssueType.public_dataset_without_citation, release.name
            )

        release_name_set.add(release.name)

    if not len(release_name_set) == len(downloads):
        all_release_names = [release.name for release in downloads]
        issues.append(
            DownloadIssueType.duplicate_release_name,
            str(
                {
                    "Release {} with {} duplicates".format(
                        name, all_release_names.count(name)
                    )
                    for name in all_release_names
                    if all_release_names.count(name) > 1
                }
            ),
        )

    # having logged duplicate ids, just collapse them
    taiga_ids = set(taiga_ids)

    # Every dataset in the portal has a download item in hand curated config
    datasets_by_taiga_id = collections.defaultdict(lambda: set())
    for dataset_name, taiga_id in dataset_err_msg_name_and_taiga_id:

        if taiga_id not in taiga_ids and not any(
            taiga_id.startswith(ex) for ex in download_file_startswith_exceptions
        ):
            if taiga_id in retracted_taiga_ids:
                issues.append(
                    DownloadIssueType.dataset_file_is_retracted,
                    "{} with Taiga ID {}".format(dataset_name, taiga_id),
                )
            else:
                issues.append(
                    DownloadIssueType.dataset_without_file,
                    "{} with Taiga ID {}".format(dataset_name, taiga_id),
                )

        datasets_by_taiga_id[taiga_id].add(dataset_name)

    fixmes = _get_instances_of_fixme()

    if len(fixmes) > 0:
        for fixme in fixmes:
            issues.append(DownloadIssueType.fixme_found, fixme)

    assert len(issues.issues) == 0, issues.get_issues_description()
    print("download data checks passed")


def _get_canonical_taiga_ids():
    """
    :return: (set of non-retracted canonical ids, set of retracted canonical ids)
    """

    taiga_ids = (
        set()
    )  # this is a list and not a set, so that post deploy can detect duplicates
    retracted_taiga_ids = set()
    downloads = get_download_list()
    for release in downloads:
        for file in release.all_files:
            for taiga_id in [file.taiga_id, file.original_satisfies_db_taiga_id]:
                if taiga_id is not None:
                    if file.is_retracted:
                        retracted_taiga_ids.add(taiga_id)
                    else:
                        taiga_ids.add(taiga_id)

    return taiga_ids, retracted_taiga_ids


def _get_instances_of_fixme():
    """
    Search downloads for any occurances of "fixme"
    Returns a list of text around any instances of "fixme"
    """
    with current_app.test_request_context():
        download_table_endpoint = (
            url_for("download.get_all_downloads"),
            json_dumps(get_all_downloads().json),
        )
        issues = []

        for name, content in [
            download_table_endpoint,
        ]:
            if "fixme" in content.casefold():
                for a, b in pairwise_with_repeat(content.casefold().split("fixme")):
                    issues.append((name, "{}fixme{}".format(a[-100:], b[:100])))
        return issues
