from depmap.enums import DataTypeEnum
from depmap.user_uploads.utils import UserUploadRecord
import requests
from unittest.mock import Mock
from loader import nonstandard_private_loader
from depmap.interactive.nonstandard.models import PrivateDatasetMetadata
from depmap.interactive.nonstandard.models import NonstandardMatrix, CellLineNameType
from tests.utilities.access_control import get_canary_group_id
from tests.factories import CellLineFactory


def test_load_private_dataset(empty_db_mock_downloads, monkeypatch):
    """
    Test
        Given a private dataset with a bucket url
        Goes through a mock version of _get_url_for_gs_object
        Given a byte stream returned from get, loads into nonstandard matrix

    Does not test the local file path. The bucket url path is more valuable to test
    """
    CellLineFactory(depmap_id="ACH-1")
    CellLineFactory(depmap_id="ACH-2")
    empty_db_mock_downloads.session.flush()
    assert len(PrivateDatasetMetadata.query.all()) == 0

    def mock_requests_get(url, **kwargs):
        mock_res = Mock()
        mock_res.iter_content.return_value = [b",x\nACH-1,1\nACH-2,2\n"]
        mock_res.status_code = 200
        return mock_res

    mock_get_url_for_gs_object = Mock(return_value="fake-url")

    monkeypatch.setattr(requests, "get", mock_requests_get)
    monkeypatch.setattr(
        nonstandard_private_loader, "_get_url_for_gs_object", mock_get_url_for_gs_object
    )

    dataset_id = "test-dataset-id"
    # download from google bucket, reformat as HDF5 and register it as a new nonstandard dataset

    private_dataset = UserUploadRecord(
        dataset_id=dataset_id,
        dataset="gs://fake/test.csv",
        display_name="display name",
        units="units",
        feature_name="feature",
        owner_id=get_canary_group_id(),
        is_transpose=True,
        cell_line_name_type=CellLineNameType.depmap_id,
        data_type=DataTypeEnum.user_upload.name,
    )
    nonstandard_private_loader.load_private_dataset_from_df_row(private_dataset)

    assert mock_get_url_for_gs_object.called

    # verify even though the load was good, we cannot see it
    matrix = NonstandardMatrix.get(dataset_id, must=False)
    assert matrix is None
    assert (
        len(NonstandardMatrix.get_all()) == 0
    )  # get_all is what we use to populate interactive... this is implicitly testing that the access controls work
    assert len(PrivateDatasetMetadata.query.all()) == 0  # access controlled

    # now monkey with the access controls
    # we usually shouldn't directly import from private_util_functions, this is just for tests
    from depmap.access_control.utils.private_util_functions import (
        _get_access_control_obj,
    )

    ac = _get_access_control_obj()
    ac.is_everything_visible = True

    # now we should be able to see it
    matrix = NonstandardMatrix.get(dataset_id)
    assert matrix.owner_id == get_canary_group_id()
    print("col", [x.row_name for x in matrix.row_index])
    assert len(list(matrix.row_index)) == 1
    assert len(list(matrix.col_index)) == 2

    assert len(NonstandardMatrix.get_all()) == 1
    assert len(PrivateDatasetMetadata.query.all()) == 1
