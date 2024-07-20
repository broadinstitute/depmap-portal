import pytest
from depmap.dataset.models import DependencyDataset
from depmap.settings.settings import TestConfig
from depmap.interactive import interactive_utils
from tests.factories import (
    MatrixFactory,
    DependencyDatasetFactory,
    NonstandardMatrixFactory,
)
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override

standard_taiga_id = "test-id.1/standard"
nonstandard_continuous = "nonstandard.1/continuous"
nonstandard_categorical = "nonstandard.1/categorical"
nonstandard_other = "other-nonstandard-dataset.1"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            nonstandard_continuous: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "data_type": "user_upload",
                "feature_name": "test feature",
                "is_continuous": True,
            },
            nonstandard_categorical: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "data_type": "user_upload",
                "feature_name": "test feature",
                "is_categorical": True,
                "categories": "fake mock, never called",
            },
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_get_matrix(app, empty_db_mock_downloads):
    """
    In this setup, we need to replace the nonstandard datasets used in test settings, hence the overriden fixture above
    """
    standard_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(), name=DependencyDataset.DependencyEnum.Avana
    )
    nonstandard_matrix = NonstandardMatrixFactory(nonstandard_continuous)
    NonstandardMatrixFactory(nonstandard_categorical)

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    assert (
        interactive_utils.get_matrix(standard_dataset.name.name)
        == standard_dataset.matrix
    )
    assert interactive_utils.get_matrix(nonstandard_continuous) == nonstandard_matrix

    with pytest.raises(NotImplementedError):
        interactive_utils.get_matrix(nonstandard_categorical)

    # standard categorical
    with pytest.raises(NotImplementedError):
        interactive_utils.get_matrix(interactive_utils.get_context_dataset())
