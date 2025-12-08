"""
This file contains tests written in the older fixture style, where interactive_db_mock_downloads contains a fixed set of loaded data
We now prefer the newer style using test factories, but have not moved old tests over
The two types are separated into different files because an overriden TestConfig applies to the entire file
The nonstandard functionality for valid_row is tested in test_interactive_utils, since there aren't that many paths
"""
import pytest

from depmap.interactive.nonstandard import nonstandard_utils
from depmap.gene.models import Gene
from tests.depmap.interactive.fixtures import *

# nonstandard get_matrix is tested in tests/.../interactive_utils


def test_get_all_col_names(interactive_db_mock_downloads):
    """
    Just for the first dataset, check that col names are the same as if loading from R
    Should collapse with get_row_names
    Should also collapse to write one csv instead of 10...
    """
    col_names, indices = nonstandard_utils.get_all_col_names_indices(
        nonstandard_nonaliased_dataset_id
    )
    assert col_names[0] == "ACH-001001"  # expected first
    assert len(col_names) == 2  # expected_length

    col_names, indices = nonstandard_utils.get_all_col_names_indices(
        prepopulated_dataset
    )  # this uses arxspan
    assert col_names == [
        "ACH-000014",
        "ACH-000052",
        "ACH-000552",
        "ACH-000788",
        "ACH-000580",
        "ACH-001001",
        "ACH-000210",
        "ACH-000458",
        "ACH-000805",
    ]
    assert indices == [
        0,
        1,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
    ]  # skips 2 which has an invalid arxspan id


@pytest.mark.parametrize(
    "dataset, expected",
    [(nonstandard_nonaliased_dataset_id, None), (nonstandard_aliased_dataset_id, Gene)],
)
def test_get_entity_class(interactive_db_mock_downloads, dataset, expected):
    assert nonstandard_utils.get_entity_class(dataset) == expected
