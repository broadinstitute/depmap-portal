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
from loader import nonstandard_loader, global_search_loader
from depmap.access_control import PUBLIC_ACCESS_GROUP

# nonstandard get_matrix is tested in tests/.../interactive_utils


@pytest.mark.parametrize(
    "dataset, prefix",
    [
        (nonstandard_nonaliased_dataset_id, "met"),
        (nonstandard_nonaliased_dataset_id, "MET"),
    ],
)
def test_get_rows_starting_with(interactive_db_mock_downloads, dataset, prefix):
    """
    Test for:
    Case insensitivity
    Also works for custom datasets and non-axis datasets
    Sorted such that MET appears despite > 10 other values that contain the prefix MET
    """
    expected = [
        "MET",
        "METAP1",
        "METAP1D",
        "METAP2",
        "METRN",
        "METRNL",
        "METTL1",
        "METTL10",
        "METTL11B",
        "METTL12",
    ]

    print(nonstandard_utils.get_rows_starting_with(dataset, prefix))
    assert nonstandard_utils.get_rows_starting_with(dataset, prefix) == expected


@pytest.mark.parametrize("prefix", [("mettl2"), ("METTL2")])
def test_get_label_aliases_starting_with(interactive_db_mock_downloads, prefix):
    """
    Test for:
    Exact match for label or alias appears before partial matches
    i.e. for the search mettl2, METTL2A appears before METTL21A despite METTL21A being first in alphabetical sort order, because METTL2 is an exact match alias of METTL2A
    Case insensitivity
    Alias order doesn't matter
    """
    global_search_loader.load_global_search_index()  # the query uses the global search index
    interactive_db_mock_downloads.session.flush()

    # THIS TEST IS IMPORTANT AND THIS ORDER IS IMPORTANT. Be wary of changing the order; a change in order likely indicates that some functionality is broken
    expected_list = [
        ("METTL2A", {"FLJ12760", "METTL2"}),
        ("METTL2B", {"METL", "FLJ11350", "METTL2"}),
        ("METTL21A", {"LOC151194", "FAM119A", "HSPA-KMT", "HCA557b"}),
        ("METTL21C", {"LOC196541", "C13orf39"}),
        ("METTL22", {"MGC2654", "C16orf68", "FLJ12433"}),
        ("METTL23", {"LOC124512", "C17orf95"}),
        ("METTL24", {"dJ71D21.2", "C6orf186"}),
        ("METTL25", {"C12orf26", "FLJ22789"}),
        ("METTL26", {"C16orf13", "MGC13114"}),
    ]
    label_aliases_list = nonstandard_utils._get_label_aliases_starting_with(
        nonstandard_aliased_dataset_id, prefix
    )
    assert len(label_aliases_list) == len(expected_list)
    for label_aliases, expected in zip(label_aliases_list, expected_list):
        assert label_aliases[0] == expected[0]
        assert set(label_aliases[1]) == expected[1]


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
