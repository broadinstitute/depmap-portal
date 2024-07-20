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


def test_get_all_row_names(app, empty_db_mock_downloads):
    """
    Test on two test datasets that have prepopulate True 
    We do want to make sure that these are sorted alphabetically, case insentitive
    """
    from tests.factories import CellLineFactory

    CellLineFactory(depmap_id="ACH-000014")
    empty_db_mock_downloads.session.flush()

    loader_data_dir = app.config["LOADER_DATA_DIR"]
    source_file_path = os.path.join(
        loader_data_dir, prepopulated_dataset_file_path_suffix
    )
    nonstandard_loader.add_nonstandard_matrix(
        prepopulated_dataset, source_file_path, PUBLIC_ACCESS_GROUP
    )

    assert (
        nonstandard_utils.get_all_row_names(prepopulated_dataset)
        == prepopulated_dataset_row_names
    )


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


def test_get_random_row_name(interactive_db_mock_downloads):
    # this is not a great test due to its brittleness, but ideally this method is temporary and the test can go away
    # with the method
    row_name = nonstandard_utils.get_random_row_name(nonstandard_nonaliased_dataset_id)
    assert row_name in [
        "A1BG",
        "ABCA9",
        "ABCD1",
        "CA9",
        "ME1",
        "ME2",
        "ME3",
        "MEA1",
        "MEAF6",
        "MECOM",
        "MECP2",
        "MECR",
        "MED1",
        "MED10",
        "MED11",
        "MED12",
        "MED12L",
        "MED13",
        "MED13L",
        "MED14",
        "MED15",
        "MED16",
        "MED17",
        "MED18",
        "MED20",
        "MED21",
        "MED22",
        "MED23",
        "MED24",
        "MED25",
        "MED26",
        "MED27",
        "MED28",
        "MED29",
        "MED30",
        "MED31",
        "MED4",
        "MED6",
        "MED7",
        "MED8",
        "MED9",
        "MEDAG",
        "MEF2A",
        "MEF2C",
        "MEF2D",
        "MEFV",
        "MEGF10",
        "MEGF11",
        "MEGF6",
        "MEGF8",
        "MEGF9",
        "MEI1",
        "MEI4",
        "MEIG1",
        "MEIOB",
        "MEIOC",
        "MEIS1",
        "MEIS2",
        "MEIS3",
        "MELK",
        "MELTF",
        "MEMO1",
        "MEN1",
        "MEOX1",
        "MEOX2",
        "MEP1A",
        "MEP1B",
        "MEPCE",
        "MEPE",
        "MERTK",
        "MESDC1",
        "MESDC2",
        "MESP1",
        "MESP2",
        "MEST",
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
        "METTL13",
        "METTL14",
        "METTL15",
        "METTL16",
        "METTL17",
        "METTL18",
        "METTL21A",
        "METTL21B",
        "METTL21C",
        "METTL22",
        "METTL23",
        "METTL24",
        "METTL25",
        "METTL26",
        "METTL2A",
        "METTL2B",
        "METTL3",
        "METTL4",
        "METTL5",
        "METTL6",
        "METTL7A",
        "METTL7B",
        "METTL8",
        "METTL9",
        "MEX3A",
        "MEX3B",
        "MEX3C",
        "MEX3D",
        "SPACA9",
        "ZYX",
    ]
