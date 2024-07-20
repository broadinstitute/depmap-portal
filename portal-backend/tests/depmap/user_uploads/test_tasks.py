import os
from depmap.enums import DataTypeEnum
import pytest
import pandas as pd
from typing import Any
from dataclasses import dataclass, asdict

from depmap import data_access
from depmap.user_uploads.tasks import (
    upload_private,
    upload_transient_csv,
    upload_transient_taiga,
    convert_to_hdf5,
    validate_df_indices,
)
from depmap.access_control.utils import (
    get_current_user_for_access_control,
    assume_user,
    PUBLIC_ACCESS_GROUP,
)
from depmap.interactive.config.models import Config
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    PrivateDatasetMetadata,
    CustomDatasetConfig,
    CellLineNameType,
)
from depmap.utilities.hdf5_utils import open_hdf5_file
from depmap.utilities.exception import UserError
from tests.conftest import InteractiveConfigFakeMutationsDownload
from tests.factories import CellLineFactory
from tests.depmap.user_uploads.user_upload_fixtures import UserUploadFixture
from tests.utilities.access_control import get_canary_group_id


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


def test_upload_private(
    empty_db_mock_downloads,
    mock_celery_task_update_state,
    upload_private_dataset_setup,
):
    """
    Largely copied from the old private dataset upload test
    Make sure to test that
        df is correctly transposed
        NonstandardMatrix object exists
        Using the returned dataset id, can access interactive_utils methods like get_row_of_values
        PrivateDatasetMetadata object exists
        exists in mock bucket

    upload_private_dataset_setup is a fixture with setup like mocking the google bucket
    """
    fixture = UserUploadFixture()
    CellLineFactory(
        depmap_id=fixture.cell_line
    )  # the only cell line in the canary dataset
    empty_db_mock_downloads.session.flush()

    with assume_user("someone@canary.com"):
        assert len(NonstandardMatrix.query.all()) == 0
        assert len(PrivateDatasetMetadata.query.all()) == 0
        assert len(CustomDatasetConfig.query.all()) == 0
        upload_private(
            label="Canary",
            units="chirps",
            csv_path=fixture.file_path,
            data_file_name=fixture.file_name,
            content_type=None,
            is_transpose=True,
            user_id=get_current_user_for_access_control(),
            group_id=get_canary_group_id(),
            data_type_for_upload=DataTypeEnum.crispr.name,
        )

        assert len(NonstandardMatrix.query.all()) == 1
        assert len(PrivateDatasetMetadata.query.all()) == 1
        assert len(CustomDatasetConfig.query.all()) == 0  # does not add to custom

        private_dataset_metadata = PrivateDatasetMetadata.query.all()[0]
        dataset_id = private_dataset_metadata.dataset_id
        assert NonstandardMatrix.query.all()[0].nonstandard_dataset_id == dataset_id

        print(len(PrivateDatasetMetadata.query.all()))
        print(len(PrivateDatasetMetadata.query.all()))

        assert data_access.get_row_of_values(dataset_id, fixture.row_name).equals(
            fixture.expected_row_of_values.astype(dtype="float32")
        )

        assert dataset_id in data_access.get_private_datasets()

        # fixme assert correctly uploaded to mock bucket, and correctly added to master map

    # Access control is the most important failure mode to test
    # User not in group should not be able to access dataset
    assert dataset_id not in data_access.get_private_datasets()

    with pytest.raises(UserError):
        # User not in group should not be able to upload a dataset with that group
        upload_private(
            label="Canary",
            units="chirps",
            csv_path=fixture.file_path,
            data_file_name=fixture.file_name,
            content_type=None,
            is_transpose=True,
            user_id=get_current_user_for_access_control(),
            group_id=get_canary_group_id(),
        )


def test_upload_to_public_group(
    empty_db_mock_downloads,
    mock_celery_task_update_state,
    upload_private_dataset_setup,
):
    """
    Largely copied from test_upload_private
    Make sure to test that uploads to public group as a normal user are rejected but admins are accepted
    """
    fixture = UserUploadFixture()
    CellLineFactory(
        depmap_id=fixture.cell_line
    )  # the only cell line in the canary dataset
    empty_db_mock_downloads.session.flush()

    assert len(NonstandardMatrix.query.all()) == 0
    assert len(PrivateDatasetMetadata.query.all()) == 0
    assert len(CustomDatasetConfig.query.all()) == 0

    with pytest.raises(UserError):
        upload_private(
            label="Canary",
            units="chirps",
            csv_path=fixture.file_path,
            data_file_name=fixture.file_name,
            content_type=None,
            is_transpose=True,
            user_id="someone@canary.com",
            group_id=PUBLIC_ACCESS_GROUP,
        )

    assert len(NonstandardMatrix.query.all()) == 0
    assert len(PrivateDatasetMetadata.query.all()) == 0
    assert len(CustomDatasetConfig.query.all()) == 0

    upload_private(
        label="Canary",
        units="chirps",
        csv_path=fixture.file_path,
        data_file_name=fixture.file_name,
        content_type=None,
        is_transpose=True,
        user_id="dev@sample.com",  # in settings.py access_contorl_config.py this is set up as an admin account for the TestConfig
        group_id=PUBLIC_ACCESS_GROUP,
    )

    assert len(NonstandardMatrix.query.all()) == 1
    assert len(PrivateDatasetMetadata.query.all()) == 1
    assert len(CustomDatasetConfig.query.all()) == 0  # does not add to custom


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


def test_upload_transient_taiga(
    empty_db_mock_downloads, mock_taiga_client, mock_celery_task_update_state
):
    """
    :param mock_taiga_client: this fixture loads the test_avana.hdf5 file
    """
    is_transpose = True
    label = "test label"
    units = "test units"
    taiga_id = "test_taiga_id"
    expected_config = {
        "transpose": True,
        "taiga_id": taiga_id,
        "feature_name": "feature",
        "units": units,
        "data_type": "user_upload",
        "label": label,
        "is_standard": False,
        "is_custom": True,
        "is_continuous": True,
        "is_discoverable": False,
    }
    verify_first_add(
        empty_db_mock_downloads,
        lambda: upload_transient_taiga(label, units, is_transpose, taiga_id),
        expected_config,
    )
    verify_duplicate_add(
        lambda: upload_transient_taiga(label, units, is_transpose, taiga_id),
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
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
        ],
        index=["cell_line_1", "cell_line_2", "cell_line_2"],
    )
    with pytest.raises(UserError) as e:
        validate_df_indices(duplicate_cell_line_df, True, CellLineNameType.ccle_name)
        assert (
            str(e.value)
            == "Cell lines must be unique. Duplicate cell lines found: 2 of cell_line_2"
        )

    # duplicate in non-cell line index
    duplicate_feature_df = pd.DataFrame(
        [
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
        ],
        index=["cell_line_1", "cell_line_2", "cell_line_3"],
    )
    duplicate_feature_df = duplicate_feature_df.rename(
        columns={"feature_2": "feature_1"}
    )
    with pytest.raises(UserError) as e:
        validate_df_indices(duplicate_feature_df, True, CellLineNameType.ccle_name)
        assert (
            str(e.value)
            == "Indices must be unique. Duplicates found: 2 of duplicate_feature"
        )

    # no cell lines matched
    no_matching_cell_lines_df = pd.DataFrame(
        [
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
        ],
        index=["does_not_exist_1", "does_not_exist_2", "does_not_exist_3"],
    )
    with pytest.raises(UserError) as e:
        validate_df_indices(no_matching_cell_lines_df, True, CellLineNameType.ccle_name)
        assert (
            str(e.value)
            == "No matching cell lines found: does_not_exist_1, does_not_exist_2, does_not_exist_3"
        )

    # returns a list of any warnings of cell lines not matching
    one_not_matching_df = pd.DataFrame(
        [
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
            {"feature_1": 1, "feature_2": 2},
        ],
        index=["cell_line_1", "cell_line_2", "does_not_exist_3"],
    )
    warnings = validate_df_indices(
        one_not_matching_df, True, CellLineNameType.ccle_name
    )
    assert warnings == [
        "2 out of 3 cell lines matched. Could not match: does_not_exist_3."
    ]

    # can handle either transpose, also no warnings, and depmap id name type
    transpose_false_no_warnings_df = pd.DataFrame(
        [
            {"cell_line_1": 1, "cell_line_2": 2},
            {"cell_line_1": 1, "cell_line_2": 2},
            {"cell_line_1": 1, "cell_line_2": 2},
        ],
        index=["ACH-000001", "ACH-000002", "ACH-000003"],
    )
    warnings = validate_df_indices(
        transpose_false_no_warnings_df, False, CellLineNameType.ccle_name
    )
    assert warnings == []
