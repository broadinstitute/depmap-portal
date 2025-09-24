import os
import pytest
import pandas as pd
from typing import Any
from dataclasses import dataclass, asdict

from depmap import data_access
from depmap.user_uploads.tasks import (
    upload_transient_csv,
    validate_df_indices,
    map_ccle_index_to_depmap_id,
    read_and_validate_csv_shape,
)
from depmap.interactive.config.models import Config
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    CustomDatasetConfig,
    CellLineNameType,
)
from depmap.utilities.hdf5_utils import open_hdf5_file
from depmap.utilities.exception import UserError
from tests.conftest import InteractiveConfigFakeMutationsDownload
from tests.factories import CellLineFactory
from tests.depmap.user_uploads.user_upload_fixtures import UserUploadFixture


@dataclass
class TransientArgs:
    label: str
    units: str
    is_transpose: bool


@dataclass
class TransientCsvArgs(TransientArgs):
    data_file_dict: Any
    single_column: bool


@dataclass
class TransientTaigaArgs(TransientArgs):
    taiga_id: str

    def to_dict(self) -> dict:
        return asdict(self)


def test_read_and_validate_csv_shape(empty_db_mock_downloads):
    """
    Test that the read_and_validate_csv_shape returns a 
    dataframe in the format breadbox expects.
    """
    file_path = UserUploadFixture().file_path

    # Test the case where data does not need to be re-oriented
    output_df1 = read_and_validate_csv_shape(
        csv_path=file_path,
        single_column=False,
        is_transpose=True,
    )

    assert output_df1["index"].tolist() == ["ACH-000425"]
    assert output_df1["wing speed"].tolist() == [10.0]
    assert output_df1["weight"].tolist() == [2.0]

    # Test the case where data does need to be re-oriented
    output_df2 = read_and_validate_csv_shape(
        csv_path=file_path,
        single_column=False,
        is_transpose=False,
    )
    assert output_df2["index"].tolist() == ["wing speed", "weight"]
    assert output_df2["ACH-000425"].tolist() == [10.0, 2.0]


def test_map_ccle_index_to_depmap_id(empty_db_mock_downloads):
    """
    Test that a given dataframe is updated to use depmap_ids instead of ccle_names as the index column.
    """
    # Note: the "CCLE name" is the "cell_line_name"
    CellLineFactory(cell_line_name="cell_line_1", depmap_id="ACH-000001")
    CellLineFactory(cell_line_name="cell_line_2", depmap_id="ACH-000002")
    CellLineFactory(cell_line_name="cell_line_3", depmap_id="ACH-000003")

    basic_input_df = pd.DataFrame(
        [
            {"index": "cell_line_1", "feature_1": 1, "feature_2": 4},
            {"index": "cell_line_2", "feature_1": 2, "feature_2": 5},
            {"index": "cell_line_3", "feature_1": 3, "feature_2": 6},
        ],
    )
    output_df = map_ccle_index_to_depmap_id(basic_input_df)
    assert list(output_df["index"]) == ["ACH-000001", "ACH-000002", "ACH-000003"]

    df_with_row_missing_metadata = pd.DataFrame(
        [
            {"index": "cell_line_1", "feature_1": 1, "feature_2": 4},
            {"index": "cell_line_2", "feature_1": 2, "feature_2": 5},
            {"index": "cell_line_3", "feature_1": 3, "feature_2": 6},
            {"index": "cell_line_4", "feature_1": 0, "feature_2": 0},
        ],
    )
    output_df = map_ccle_index_to_depmap_id(df_with_row_missing_metadata)
    assert list(output_df["index"]) == ["ACH-000001", "ACH-000002", "ACH-000003"]



# TODO: update this test as well
def test_validate_df_indices(empty_db_mock_downloads):
    """
    test that
        errors if
            duplicate cell line names
            duplicate in non-cell line index
            no cell lines matched
        returns a list of any warnings of cell lines not matching
        can handle either transpose
        can handle different cell line name types
    """
    CellLineFactory(cell_line_name="cell_line_1", depmap_id="ACH-000001")
    CellLineFactory(cell_line_name="cell_line_2", depmap_id="ACH-000002")
    CellLineFactory(cell_line_name="cell_line_3", depmap_id="ACH-000003")

    # duplicate cell line names
    duplicate_cell_line_df = pd.DataFrame(
        [
            {"index": "cell_line_1", "feature_1": 1, "feature_2": 2},
            {"index": "cell_line_2", "feature_1": 1, "feature_2": 2},
            {"index": "cell_line_2", "feature_1": 1, "feature_2": 2},
        ],
    )
    with pytest.raises(UserError) as e:
        validate_df_indices(duplicate_cell_line_df, CellLineNameType.ccle_name)
        assert (
            str(e.value)
            == "Cell lines must be unique. Duplicate cell lines found: 2 of cell_line_2"
        )

    # duplicate in non-cell line index
    duplicate_feature_df = pd.DataFrame(
        [
            {"index": "cell_line_1", "feature_1": 1, "feature_2": 2},
            {"index": "cell_line_2", "feature_1": 1, "feature_2": 2},
            {"index": "cell_line_3", "feature_1": 1, "feature_2": 2},
        ],
    )
    duplicate_feature_df = duplicate_feature_df.rename(
        columns={"feature_2": "feature_1"}
    )
    with pytest.raises(UserError) as e:
        validate_df_indices(duplicate_feature_df, CellLineNameType.ccle_name)
        assert (
            str(e.value)
            == "Indices must be unique. Duplicates found: 2 of duplicate_feature"
        )

    # no cell lines matched
    no_matching_cell_lines_df = pd.DataFrame(
        [
            {"index": "does_not_exist_1", "feature_1": 1, "feature_2": 2},
            {"index": "does_not_exist_2", "feature_1": 1, "feature_2": 2},
            {"index": "does_not_exist_3", "feature_1": 1, "feature_2": 2},
        ],
    )
    with pytest.raises(UserError) as e:
        validate_df_indices(no_matching_cell_lines_df, CellLineNameType.ccle_name)
        assert (
            str(e.value)
            == "No matching cell lines found: does_not_exist_1, does_not_exist_2, does_not_exist_3"
        )

    # returns a list of any warnings of cell lines not matching
    one_not_matching_df = pd.DataFrame(
        [
            {"index": "cell_line_1", "feature_1": 1, "feature_2": 2},
            {"index": "cell_line_2", "feature_1": 1, "feature_2": 2},
            {"index": "does_not_exist_3", "feature_1": 1, "feature_2": 2},
        ],
        index=["cell_line_1", "cell_line_2", "does_not_exist_3"],
    )
    warnings = validate_df_indices(
        one_not_matching_df, CellLineNameType.ccle_name
    ) # errors here
    assert warnings == [
        "2 out of 3 cell lines matched. Could not match: does_not_exist_3."
    ]

    # can handle either transpose, also no warnings, and depmap id name type
    no_warnings_df = pd.DataFrame(
        [
            {"index": "ACH-000001", "feature_1": 1, "feature_2": 2},
            {"index": "ACH-000002", "feature_1": 1, "feature_2": 2},
            {"index": "ACH-000003", "feature_1": 1, "feature_2": 2},
        ],
    )
    warnings = validate_df_indices(
        no_warnings_df, CellLineNameType.depmap_id
    )
    assert warnings == []
