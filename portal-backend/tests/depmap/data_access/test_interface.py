import pandas as pd

from depmap import data_access
from depmap.dataset.models import TabularDataset, BiomarkerDataset, DependencyDataset
from depmap.settings.settings import TestConfig
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override
from tests.factories import (
    NonstandardMatrixFactory,
    CellLineFactory,
    DependencyDatasetFactory,
    GeneFactory,
    MatrixFactory,
)


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


@override(config=config)
def test_get_slice_data_for_matrix_dataset(app, empty_db_mock_downloads):
    # Set up a simple 5x5 dataset where samples are cell lines and features are genes
    cell_lines = CellLineFactory.create_batch(5)
    genes = GeneFactory.create_batch(5)
    standard_dataset_name = DependencyDataset.DependencyEnum.Chronos_Combined
    DependencyDatasetFactory(
        matrix=MatrixFactory(cell_lines=cell_lines, entities=genes),
        name=standard_dataset_name,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Load the identifiers to use in the test
    dataset_id = standard_dataset_name.name
    feature_labels_by_id = data_access.get_dataset_feature_labels_by_id(dataset_id)
    sample_ids = data_access.get_dataset_sample_ids(dataset_id)

    # Test a query by feature ID
    query_gene = genes[0]
    feature_id_query = data_access.SliceQuery(
        dataset_id=dataset_id,
        identifier=query_gene.entrez_id,
        indentifier_type=data_access.SliceIdentifierType.feature_id,
    )
    result = data_access.get_slice_data(slice_query=feature_id_query)
    assert result is not None
    breakpoint()

    dataset_df = data_access.get_subsetted_df_by_labels(
        nonstandard_dataset_id, None, sample_ids
    )
