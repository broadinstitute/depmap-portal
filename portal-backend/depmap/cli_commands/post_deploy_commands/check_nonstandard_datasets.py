from enum import Enum
import click
from flask.cli import with_appcontext
from flask import current_app

from depmap.data_access import breadbox_dao
from depmap.interactive import interactive_utils
from depmap.interactive.nonstandard.models import NonstandardMatrix
from depmap.access_control import all_records_visible


class NonstandardIssueType(Enum):
    """
    Helps with testing
    """

    nonstandard_matrix_not_in_interactive_config = "NonstandardMatrix not in settings"
    nonstandard_dataset_not_in_db = "Nonstandard dataset missing from db"


class NonstandardIssues:
    def __init__(self):
        self.issues = []

    def append(self, type, text):
        """
        This forces addition of an issue type
        And wraps the two into a tuple for us
        """
        self.issues.append((type, text))

    def get_issues_description(self):
        string = "Nonstandard dataset issues detected:\n"
        for type, text in self.issues:
            string += "\n\t{}: {}".format(type.value, text)
        return string


# the cli command here is used in the deploy-data repo, not in depmap
@click.command("check_nonstandard_datasets")
@with_appcontext
def check_nonstandard_datasets():
    """
    Check that loaded nonstandard datasets are in sync with the configured nonstandard datasets
        This arose from https://www.pivotaltracker.com/story/show/171091705
        What can happen is that a nonstandard dataset might get its taiga id bumped without a clean reload
        This causes the old NonstandardMatrix to still exist in the db
        The tree queries the NonstandardMatrix table to get all datasets
        It then uses interactive_utils to access information about the dataset
        However, the old NonstandardMatrix is not in the interactive config because it had been removed (taiga id was bumped) from our written nonstandard dataset configuration
        Our db load process lets us incrementally add a new nonstandard matrix. However, it does not have a mechanism to incrementally remove old ones
        Thus, this check exists to at least alert us of this imbalance
    """
    # fixme for the download check, stuff here was abstracted for testing
    with all_records_visible():
        issues = _get_nonstandard_dataset_issues()
    assert len(issues.issues) == 0, issues.get_issues_description()
    print("Nonstandard dataset checks passed")


def _get_nonstandard_dataset_issues():
    issues = NonstandardIssues()

    for matrix in NonstandardMatrix.get_all():
        if not interactive_utils.has_config(matrix.nonstandard_dataset_id):
            issues.append(
                NonstandardIssueType.nonstandard_matrix_not_in_interactive_config,
                "NonstandardMatrix {} not found in interactive config. If this is a non-custom dataset, this may imply a stale dataset that was deleted from settings but still exists in the db. The solution here is a clean db load.".format(
                    matrix.nonstandard_dataset_id
                ),
            )

    for dataset_id in current_app.config["GET_NONSTANDARD_DATASETS"]().keys():
        # we technically should not encounter this issue
        # because the db load is currently set up to incrementally and automatically load any configured nonstandard datasets not yet in the db
        # however, this doesn't hurt to check
        if NonstandardMatrix.get(dataset_id, must=False) is None:
            issues.append(
                NonstandardIssueType.nonstandard_dataset_not_in_db,
                "Nonstandard dataset {} found in GET_NONSTANDARD_DATASETS settings but is not in the db.".format(
                    dataset_id
                ),
            )
    return issues


@click.command("check_legacy_db_mirrors_breadbox")
@with_appcontext
def check_legacy_db_mirrors_breadbox():
    """
    Check that datasets in the legacy database use the same taiga IDs as their corresponding breadbox datasets.
    Any datasets where the legacy dataset ID matches the breadbox given ID should also have matching taiga IDs.
    This ensures that the data versions are used in both places - even though they're configured separately.
    At this point, we also expect that all legacy dataset IDs exist in the breadbox database.
    """
    legacy_dataset_ids = interactive_utils.get_all_dataset_ids()
    all_breadbox_given_ids = breadbox_dao.get_breadbox_given_ids()

    issues = []
    for legacy_dataset_id in legacy_dataset_ids:
        # if the legacy dataset ID is also a breadbox given ID, check that the taiga IDs match
        if legacy_dataset_id in all_breadbox_given_ids:
            legacy_taiga_id = interactive_utils.get_taiga_id(legacy_dataset_id)
            breadbox_taiga_id = breadbox_dao.get_dataset_taiga_id(legacy_dataset_id)

            if legacy_taiga_id != breadbox_taiga_id:
                issues.append(
                    "Mismatch in taiga IDs for dataset '{}': legacy db taiga ID is '{}', breadbox taiga ID is '{}'".format(
                        legacy_dataset_id, legacy_taiga_id, breadbox_taiga_id
                    )
                )
        else:
            issues.append(
                "Legacy dataset ID '{}' not found in breadbox given IDs".format(
                    legacy_dataset_id
                )
            )
    if issues:
        issue_text = "Unexpected mismatches detected between the legacy DB and breadbox DB:\n"
        for issue in issues:
            issue_text += "\n\t{}".format(issue)
        raise AssertionError(issue_text)