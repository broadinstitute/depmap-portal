import os
import pytest
import pandas as pd
from typing import Any
from dataclasses import dataclass, asdict

from depmap import data_access
from depmap.user_uploads.tasks import (
    upload_transient_csv,
    convert_to_hdf5,
    validate_df_indices,
    map_ccle_index_to_depmap_id,
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


def test_upload_transient_csv(empty_db_mock_downloads, mock_celery_task_update_state):
    is_transpose = True
    label = "test label"
    units = "test units"
    expected_config = {
        "transpose": True,
        "feature_name": "feature",
        "units": units,
        "data_type": "user_upload",
        "label": label,
        "is_standard": False,
        "is_custom": True,
        "is_continuous": True,
        "is_discoverable": False,
    }  # no taiga_id key

    file_path = UserUploadFixture().file_path
    verify_first_add(
        empty_db_mock_downloads,
        lambda: upload_transient_csv(label, units, is_transpose, file_path, False),
        expected_config,
    )

    # same file, again
    verify_duplicate_add(
        lambda: upload_transient_csv(label, units, is_transpose, file_path, False),
        expected_config,
    )

# fixme add tests for the warnings, and other failure modes


def verify_first_add(
    empty_db_mock_downloads, upload_function, expected_config,
):
    """
    Called by taiga and csv test functions
    Test that
        file was pulled and added to NONSTANDARD_DATA_DIR
        NonstandardMatrix, and row and col indices added
        CustomDatasetConfig added, and config is as expected
        config was added to InteractiveConfig
    """
    fixture = UserUploadFixture()
    CellLineFactory(
        depmap_id=fixture.cell_line
    )  # the only cell line in the canary dataset
    empty_db_mock_downloads.session.flush()
    cache_dir = empty_db_mock_downloads.app.config["NONSTANDARD_DATA_DIR"]
    # start with nothing
    assert len(os.listdir(cache_dir)) == 0
    assert NonstandardMatrix.query.count() == 0
    assert CustomDatasetConfig.query.count() == 0

    # add first dataset
    result = upload_function()
    uuid = result["datasetId"]

    assert len(os.listdir(cache_dir)) == 1

    assert NonstandardMatrix.query.count() == 1
    assert os.path.exists(
        os.path.join(cache_dir, NonstandardMatrix.query.first().file_path)
    )
    assert CustomDatasetConfig.query.count() == 1
    assert CustomDatasetConfig.get(uuid) == expected_config

    interactive_config = InteractiveConfigFakeMutationsDownload()
    config = interactive_config.get(uuid)
    assert config == Config(**expected_config)

    # this also verifies that the transpose setting is consistent
    assert data_access.get_row_of_values(uuid, fixture.row_name).equals(
        fixture.expected_row_of_values.astype(dtype="float32")
    )


def verify_duplicate_add(upload_function, expected_config):
    """
    Test add same dataset again
    """
    result = upload_function()
    uuid_2 = result["datasetId"]

    # this does not test that file is not re-pulled
    # for custom taiga, not re-saving a file is handled by taigapy
    # for custom csv, not re-saving is tested in test_convert_and_move_file

    # but should have new NonstandardMatrix, CustomDatasetConfig, and entry in interactive config
    assert NonstandardMatrix.query.count() == 2
    assert CustomDatasetConfig.query.count() == 2
    assert CustomDatasetConfig.get(uuid_2) == expected_config

    interactive_config = InteractiveConfigFakeMutationsDownload()
    config = interactive_config.get(uuid_2)
    assert config == Config(**expected_config)


def test_convert_to_hdf5(app):
    # no file there initially
    source_dir = app.config["NONSTANDARD_DATA_DIR"]
    assert len(os.listdir(source_dir)) == 0

    # create two dfs with the same contents
    # test that even if they are different pandas objects, return the same file name
    df1 = pd.DataFrame([1.2, 3.4], ["row1", "row2"], ["col"])
    df2 = pd.DataFrame([1.2, 3.4], ["row1", "row2"], ["col"])

    # file add
    file_name_1 = convert_to_hdf5(df1)
    assert (
        file_name_1
        == "3bb557bd6647873d976cb9b748ccd642954b82aa4ee4cd686818f8749e60104a.hdf5"
    )
    # check that file exists
    assert len(os.listdir(source_dir)) == 1
    assert os.path.exists(os.path.join(source_dir, file_name_1))

    # check that is valid hdf5 file
    # this implicitly also tests open_hdf5_file
    with open_hdf5_file(source_dir, file_name_1) as f:
        assert len(list(f["data"][:, 0])) == 2
        assert len(list(f["data"][1, :])) == 1
        assert len(list(f["dim_0"])) == 2
        assert len(list(f["dim_1"])) == 1

    # test that running again with a df with the same contents doesnt add another file
    file_name_2 = convert_to_hdf5(df2)
    assert file_name_2 == file_name_1
    assert len(os.listdir(source_dir)) == 1


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
