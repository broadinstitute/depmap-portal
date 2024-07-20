import pytest
from depmap.dataset.models import DependencyDataset
from depmap.gene.models import Gene
from depmap.vector_catalog.trees import ContinuousValuesTree
from depmap.settings.settings import TestConfig
from tests.factories import (
    GeneFactory,
    DependencyDatasetFactory,
    MatrixFactory,
    NonstandardMatrixFactory,
)
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override

nonstandard_latest = "test-id.1/latest"
nonstandard_other = "test-id.1/other"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            nonstandard_latest: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "zzzz alphabetically later display name nonstandard",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
                "entity": Gene,
            },
            nonstandard_other: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "aaa nonstandard alphabetically first",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
                "entity": Gene,
            },
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_dataset_sort_key(empty_db_mock_downloads, app):
    """
    Test that sorting
        Puts latest datasets first, even if there is an "other" dataset with a display name that alphabetically comes first
        Puts a nonstandard dataset in the "latest" category if its display name starts with a standard dataset display name

    In this setup, we need to replace the nonstandard datasets used in test settings, hence the overriden fixture above
    """
    gene = GeneFactory()
    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(entities=[gene]),
        display_name="zzzz alphabetically later display name",
    )
    NonstandardMatrixFactory(nonstandard_dataset_id=nonstandard_latest, entities=[gene])
    NonstandardMatrixFactory(nonstandard_dataset_id=nonstandard_other, entities=[gene])

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    tree = ContinuousValuesTree()
    children = tree.get_children(tree.get_gene_node_id(gene.entity_id))
    expected_labels = [
        "zzzz alphabetically later display name",
        "zzzz alphabetically later display name nonstandard",
        "aaa nonstandard alphabetically first",
    ]  # standard comes before nonstandard due to the +0.5 on subpriority
    expected_groups = ["Latest", "Latest", "Other"]
    assert [node.label for node in children] == expected_labels
    assert [node.group for node in children] == expected_groups
