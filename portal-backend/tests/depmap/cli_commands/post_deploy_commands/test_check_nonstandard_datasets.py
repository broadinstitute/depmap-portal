from depmap.cli_commands.post_deploy_commands.check_nonstandard_datasets import (
    _get_nonstandard_dataset_issues,
    NonstandardIssueType,
)
from tests.factories import NonstandardMatrixFactory


def test_get_nonstandard_dataset_issues(empty_db_mock_downloads):
    # test config has three nonstandard datasets
    test_nonstandard_datasets = [
        "small-mapped-avana-551a.1",
        "small-avana-2987.2",
        "small-msi-dataset-aa84.4",
    ]

    extra_dataset_in_db = "not-in-test-settings.1"

    # 1) Test just the not in db issue
    # right now, none of the nonstandard datasets are in the db
    # all should complain that they are not in the db
    issues = _get_nonstandard_dataset_issues().issues
    assert len(issues) == 3
    assert all(
        [
            type == NonstandardIssueType.nonstandard_dataset_not_in_db
            for type, text in issues
        ]
    )
    issue_texts = [text for type, text in issues]
    assert all(
        [
            one_in_list_contains(issue_texts, dataset_id)
            for dataset_id in test_nonstandard_datasets
        ]
    )

    # 2) Test both issues together
    # add small-mapped-avana-551a.1 and small-avana-2987.2
    # Those complaints should be removed, and the msi complaint remains
    NonstandardMatrixFactory("small-mapped-avana-551a.1", "deprecated")
    NonstandardMatrixFactory("small-avana-2987.2", "deprecated")
    # also add a dataset not in settings
    # now we should have two types of issues
    extra_dataset = NonstandardMatrixFactory(extra_dataset_in_db)
    empty_db_mock_downloads.session.flush()

    issues = _get_nonstandard_dataset_issues().issues
    assert len(issues) == 2
    # the order of issues here doesn't matter. but the test can make use of the fact the the order is stable
    # test the extra dataset
    extra_issue_type, extra_issue_text = issues[0]
    assert (
        extra_issue_type
        == NonstandardIssueType.nonstandard_matrix_not_in_interactive_config
    )  # the other issue
    assert extra_dataset_in_db in extra_issue_text
    # test the msi issue
    msi_issue_type, msi_issue_text = issues[1]
    assert msi_issue_type == NonstandardIssueType.nonstandard_dataset_not_in_db
    assert "small-msi-dataset-aa84.4" in msi_issue_text

    # 3) Test just the extra dataset issue
    # add the msi, should only have the extra dataset complaint
    NonstandardMatrixFactory("small-msi-dataset-aa84.4")
    empty_db_mock_downloads.session.flush()
    issues = _get_nonstandard_dataset_issues().issues
    assert len(issues) == 1
    issue_type, issue_text = issues[0]
    assert (
        issue_type == NonstandardIssueType.nonstandard_matrix_not_in_interactive_config
    )  # the other issue
    assert extra_dataset_in_db in issue_text

    # 4) Everything resolved
    for row in extra_dataset.row_index.all():
        empty_db_mock_downloads.session.delete(row)
    for col in extra_dataset.col_index.all():
        empty_db_mock_downloads.session.delete(col)

    empty_db_mock_downloads.session.delete(extra_dataset)
    empty_db_mock_downloads.session.flush()
    issues = _get_nonstandard_dataset_issues().issues
    assert len(issues) == 0


def one_in_list_contains(l: list, substring: str):
    """
    Returns true one and only one element in the list contains the substring
    Returns false otherwise
    """
    element_contains_substring = [substring in element for element in l]
    return sum(element_contains_substring) == 1
