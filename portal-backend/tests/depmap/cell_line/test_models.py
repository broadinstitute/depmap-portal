from depmap.cell_line.models_new import DepmapModel, add_depmap_model_table_columns
import pytest
import pandas as pd
from depmap.cell_line.models import (
    CellLine,
    Lineage,
    add_cell_line_table_columns,
    PrimaryDisease,
    get_all_entities_and_indices_for_model,
)
from tests.factories import (
    CellLineFactory,
    LineageFactory,
    DepmapModelFactory,
    PrimaryDiseaseFactory,
)
from tests.utilities.df_test_utils import dfs_equal_ignoring_column_order


###
### DepmapModel Table Tests
###

# TODO: This will eventually replace test_add_cell_line_table_columns.
# test_add_cell_line_table_columns is used in Cell Line Selector, which still
# depends on the CellLine table.
def test_add_depmap_model_table_columns(empty_db_mock_downloads):
    """
    Test that this function tacks on the required columns
    """
    cell_line = DepmapModelFactory()
    empty_db_mock_downloads.session.flush()

    query = add_depmap_model_table_columns(DepmapModel.query)
    df = pd.read_sql(query.statement, query.session.connection())

    assert len(df) == 1

    assert df.loc[0]["cell_line_name"] == cell_line.cell_line_name
    assert df.loc[0]["primary_disease"] == cell_line.oncotree_primary_disease
    assert df.loc[0]["lineage"] == cell_line.oncotree_lineage[0].name


def test_depmap_model_cell_line_exists(empty_db_mock_downloads):
    DepmapModelFactory(cell_line_name="test_name")
    empty_db_mock_downloads.session.flush()

    assert DepmapModel.exists("test_name")
    assert not DepmapModel.exists("does_not_exist")


def test_depmap_model_get_cell_line_by_depmap_id(empty_db_mock_downloads):
    DepmapModelFactory(cell_line_name="test_name", model_id="ACH-001")
    empty_db_mock_downloads.session.flush()

    assert DepmapModel.get_by_model_id("ACH-001").cell_line_name == "test_name"
    assert DepmapModel.get_by_model_id("ACH-002", must=False) is None


def test_depmap_model_get_cell_line_name_in(empty_db_mock_downloads):
    DepmapModelFactory(cell_line_name="test_name")
    empty_db_mock_downloads.session.flush()

    cell_line_names = ["test_name", "fake_name"]

    assert DepmapModel.get_valid_cell_line_names_in(cell_line_names) == {"test_name"}


###
###
###


# Tests a function used by Cell Line Selector
def test_add_cell_line_table_columns(empty_db_mock_downloads):
    """
    Test that this function tacks on the required columns
    """
    cell_line = CellLineFactory()
    empty_db_mock_downloads.session.flush()

    query = add_cell_line_table_columns(CellLine.query)
    df = pd.read_sql(query.statement, query.session.connection())
    assert len(df) == 1
    assert df.loc[0]["cell_line_name"] == cell_line.cell_line_name
    assert df.loc[0]["primary_disease"] == cell_line.primary_disease.name
    assert df.loc[0]["lineage"] == cell_line.lineage[0].name


def test_get_all_entities_and_indices_for_model(empty_db_mock_downloads):
    PrimaryDiseaseFactory(name="test")
    PrimaryDiseaseFactory(name="a test")
    empty_db_mock_downloads.session.flush()

    # also check sorting ("a test" should have a smaller index than "test")
    assert get_all_entities_and_indices_for_model(PrimaryDisease) == [
        ("a test", 1),
        ("test", 2),
    ]


def test_cell_line_exists(empty_db_mock_downloads):
    CellLineFactory(cell_line_name="test_name")
    empty_db_mock_downloads.session.flush()

    assert CellLine.exists("test_name")
    assert not CellLine.exists("does_not_exist")


def test_get_cell_line_name_in(empty_db_mock_downloads):
    CellLineFactory(cell_line_name="test_name")
    empty_db_mock_downloads.session.flush()

    cell_line_names = ["test_name", "fake_name"]

    assert CellLine.get_valid_cell_line_names_in(cell_line_names) == {"test_name"}


def test_get_cell_line_by_depmap_id(empty_db_mock_downloads):
    CellLineFactory(cell_line_name="test_name", depmap_id="ACH-001")
    empty_db_mock_downloads.session.flush()

    assert CellLine.get_by_depmap_id("ACH-001").cell_line_name == "test_name"
    assert CellLine.get_by_depmap_id("ACH-002", must=False) is None


def test_get_cell_line_lineage_name_series(empty_db_mock_downloads):
    lineage_1_name = (
        "abc test lineage"  # for alphabetical determinism. this will have id 1
    )
    lineage_2_name = "xyz test lineage"  # this will have id 2
    lineage_1A = LineageFactory(level=1, name=lineage_1_name)
    lineage_1B = LineageFactory(level=1, name=lineage_1_name)
    lineage_2C = LineageFactory(level=1, name=lineage_2_name)
    cell_line_A = CellLineFactory(lineage=[lineage_1A])
    cell_line_B = CellLineFactory(lineage=[lineage_1B])
    cell_line_C = CellLineFactory(lineage=[lineage_2C])

    empty_db_mock_downloads.session.flush()

    expected_lineage_names = [
        lineage_1A.name,
        lineage_1A.name,
        lineage_2C.name,
    ]  # should be 1A's name, is same as 1B
    expected_cell_lines = [
        cell_line_A.depmap_id,
        cell_line_B.depmap_id,
        cell_line_C.depmap_id,
    ]

    lineage_series_name = CellLine.get_cell_line_lineage_name_series()
    assert list(lineage_series_name.values) == expected_lineage_names
    assert list(lineage_series_name.index) == expected_cell_lines


def test_get_cell_line_information_df(empty_db_mock_downloads):
    """
    Test that the functions retrieves the expected columns and values
    """
    cell_line_1 = CellLineFactory(
        lineage=[
            LineageFactory(name="level_1", level=1),
            LineageFactory(name="level_2", level=2),
            LineageFactory(name="should not retrieve", level=3),
        ]
    )
    cell_line_2 = CellLineFactory(lineage=[LineageFactory(name="level_1", level=1)])
    depmap_ids = [cell_line_1.depmap_id, cell_line_1.depmap_id, cell_line_2.depmap_id]

    expected_data = [
        {
            "cell_line_display_name": cell_line_1.cell_line_display_name,
            "primary_disease": cell_line_1.primary_disease.name,
            "lineage_name": cell_line_1.level_1_lineage.name,
            "lineage_display_name": cell_line_1.level_1_lineage.display_name,
            "lineage_level": 1,
        },
        {
            "cell_line_display_name": cell_line_1.cell_line_display_name,
            "primary_disease": cell_line_1.primary_disease.name,
            "lineage_name": [
                lineage.name
                for lineage in cell_line_1.lineage.all()
                if lineage.level == 2
            ][0],
            "lineage_display_name": [
                lineage.display_name
                for lineage in cell_line_1.lineage.all()
                if lineage.level == 2
            ][0],
            "lineage_level": 2,
        },
        {
            "cell_line_display_name": cell_line_2.cell_line_display_name,
            "primary_disease": cell_line_2.primary_disease.name,
            "lineage_name": cell_line_2.level_1_lineage.name,
            "lineage_display_name": cell_line_2.level_1_lineage.display_name,
            "lineage_level": 1,
        },
    ]

    expected_df = pd.DataFrame(expected_data, index=depmap_ids).sort_index()
    df = CellLine.get_cell_line_information_df(depmap_ids, levels=[1, 2]).sort_index()

    assert dfs_equal_ignoring_column_order(df, expected_df)

    # test that it runs without error if passed an empty list
    empty_df = CellLine.get_cell_line_information_df([])
    assert len(empty_df) == 0
    assert set(empty_df.columns) == set(expected_data[0].keys())


@pytest.mark.parametrize(
    "name, expected_name",
    [
        ("AML", "AML"),
        ("EWS_FLI", "EWS_FLI"),  # compromise on the display name of protein fusions
        ("AML_engineered", "AML Engineered"),
        ("b_cell_mantle_cell", "B-cell Mantle Cell"),
        ("t_cell_ALCL", "T-cell ALCL"),
        ("NSCLC_large_cell", "NSCLC Large Cell"),
        ("ERneg_HER2pos", "ERneg HER2pos"),
        ("hbs_antigen_carrier", "HBs Antigen Carrier"),
        ("test_name", "Test Name"),
    ],
)
def test_lineage_get_display_name(name, expected_name):
    assert Lineage.get_display_name(name) == expected_name


def test_get_lineage_lvl_1_ids(empty_db_mock_downloads):
    """
    Test that
        only gets level 1s, across multiple cell lines
        numbers alphabetically, starting with 1
    :return:
    """
    # need to create cell lines as well, because lineage expects a foreign key constraint
    # and CellLineFactory can create/specify a lineage, but not vice versa
    CellLineFactory(
        lineage=[
            LineageFactory(name="abc level 2", level=2),
            LineageFactory(name="def", level=1),
        ]
    )
    CellLineFactory(lineage=[LineageFactory(name="ghi", level=1)])
    empty_db_mock_downloads.session.flush()

    expected = [("def", 1), ("ghi", 2)]
    assert Lineage.get_lineage_lvl_1_ids() == expected


@pytest.mark.parametrize(
    "label, expect_none",
    [
        ("IGNORE (ACH-001)", False),
        ("ACH-001", False),
        ("ACH-001-01", False),
        ("ACH-001_FAILED_STR", True),
        ("sample-name", False),
    ],
)
def test_get_by_name_or_depmap_id_for_loaders(
    empty_db_mock_downloads, label, expect_none
):
    CellLineFactory(depmap_id="ACH-001", cell_line_name="sample-name")

    fetched = CellLine.get_by_name_or_depmap_id_for_loaders(
        cell_line_name=label, must=False
    )
    if expect_none:
        assert fetched is None
    else:
        assert fetched is not None
