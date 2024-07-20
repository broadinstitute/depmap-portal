# The nonstandard functionality for valid_row is tested in test_interactive_utils, since there aren't that many paths
import numpy as np
import pandas as pd
import tempfile

from depmap.settings.settings import TestConfig
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    ColNonstandardMatrix,
    RowNonstandardMatrix,
)
from tests.factories import CellLineFactory
from depmap.interactive.nonstandard import nonstandard_utils
from tests.factories import create_hdf5
from depmap.access_control import PUBLIC_ACCESS_GROUP
from tests.utilities.override_fixture import override

dataset_id = "nonstandard_arxspan_missing_id"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            dataset_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
            }
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_get_row_of_values(empty_db_mock_downloads):
    """
    This unfortunately requires a lot of set up
        Patch the test nonstandard dataset into the config, to be able to get entity class (None), transpose, and use_arxspan_id
        Make the hdf5 file
    Test that
        for a nonstandard dataset with an invalid arxspan ID
        the values still line up even if a col matrix index is missing
    Pretty import test to ensure that we don't accidentally have values shifted by one
    """
    # manual setup to create objects, instead of writing a generic factory
    t = tempfile.NamedTemporaryFile(delete=False)
    t.close()
    file_path = t.name
    data = np.array([[1, 2, 500, 3, 4]])
    row_list = ["row"]
    col_list = ["col_1", "col_2", "invalid", "col_3", "col_4"]
    create_hdf5(file_path, row_list, col_list, data)

    col_index_objects = [
        ColNonstandardMatrix(index=index, depmap_id=col, owner_id=PUBLIC_ACCESS_GROUP)
        for index, col in enumerate(col_list)
        if col != "invalid"
    ]

    cell_line_objects = [
        CellLineFactory(cell_line_name=col, depmap_id=col)
        for index, col in enumerate(col_list)
        if col != "invalid"
    ]

    dataset_index = NonstandardMatrix(
        nonstandard_dataset_id=dataset_id,
        data_type="user_upload",
        file_path=file_path,
        row_index=[
            RowNonstandardMatrix(index=0, row_name="row", owner_id=PUBLIC_ACCESS_GROUP)
        ],
        col_index=col_index_objects,
        owner_id=PUBLIC_ACCESS_GROUP,
    )
    empty_db_mock_downloads.session.add(dataset_index)
    empty_db_mock_downloads.session.flush()

    row_of_values = nonstandard_utils.get_row_of_values(dataset_id, "row")
    expected = pd.Series([1, 2, 3, 4], ["col_1", "col_2", "col_3", "col_4"])
    assert row_of_values.equals(expected)
