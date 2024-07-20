"""
This file contains one test written in the newer fixture style, where only necessary data is created and loaded via factories, and tests can customize what to create and load.
We prefer this to the older style using predetermined fixtures, but have not moved old tests over
The two types are separated into different files because an overriden TestConfig applies to the entire file
"""

from depmap.settings.settings import TestConfig
from depmap.gene.models import Gene
from depmap.interactive.nonstandard import nonstandard_utils
from depmap.interactive.common_utils import RowSummary
from tests.factories import GeneFactory, NonstandardMatrixFactory
from tests.utilities.override_fixture import override

with_entity_id = "with-entity.1"
without_entity_id = "without-entity.1"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            with_entity_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "data_type": "user_upload",
                "feature_name": "test name",
                "entity": Gene,
                "is_continuous": True,
            },
            without_entity_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "data_type": "user_upload",
                "feature_name": "test name",
                "is_continuous": True,
            },
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_get_all_row_indices_labels_entity_ids(empty_db_mock_downloads):
    """
    Test that
        gets all rowss
        with all fields expected (indices, labels, entity ids)
        works with and without entity class
    """
    gene_10 = GeneFactory(label="gene 10", entity_id=10)
    gene_20 = GeneFactory(label="gene 20", entity_id=20)

    NonstandardMatrixFactory(
        with_entity_id, entities=[gene_20, gene_10]
    )  # different order from creation
    NonstandardMatrixFactory(
        without_entity_id,
        entities=["no entity 1", "no entity 2"],
        rows_are_entities=False,
    )

    empty_db_mock_downloads.session.flush()

    expected_with_entity = [
        RowSummary(index=0, entity_id=20, label="gene 20"),
        RowSummary(index=1, entity_id=10, label="gene 10"),
    ]
    expected_without_entity = [
        RowSummary(index=0, entity_id=None, label="no entity 1"),
        RowSummary(index=1, entity_id=None, label="no entity 2"),
    ]

    assert (
        nonstandard_utils.get_all_row_indices_labels_entity_ids(with_entity_id)
        == expected_with_entity
    )
    assert (
        nonstandard_utils.get_all_row_indices_labels_entity_ids(without_entity_id)
        == expected_without_entity
    )
