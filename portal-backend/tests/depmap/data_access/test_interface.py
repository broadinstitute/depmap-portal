from depmap.data_access import get_matrix_dataset


def test_get_matrix_dataset(interactive_db_mock_downloads):
    # at the moment, we have some dictionaries hardcoded with metadata for datasets
    # this test verifies that we have entries for each dataset to catch cases where we
    # add a dataset and forget to update these maps
    interactive_config = interactive_db_mock_downloads.app._depmap_interactive_config
    dataset_ids = interactive_config._immutable_datasets.keys()

    for dataset_id in dataset_ids:
        get_matrix_dataset(dataset_id)
