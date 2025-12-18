from depmap import data_access
from depmap.settings.settings import TestConfig



nonstandard_dataset_id = "test-id.1"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            nonstandard_dataset_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "feature_name": "test name",
                "is_continuous": True,
                "data_type": "user_upload",
            }
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


def test_get_matrix_dataset(interactive_db_mock_downloads):
    # at the moment, we have some dictionaries hardcoded with metadata for datasets
    # this test verifies that we have entries for each dataset to catch cases where we
    # add a dataset and forget to update these maps
    interactive_config = interactive_db_mock_downloads.app._depmap_interactive_config
    dataset_ids = interactive_config._immutable_datasets.keys()

    for dataset_id in dataset_ids:
        data_access.get_matrix_dataset(dataset_id)
