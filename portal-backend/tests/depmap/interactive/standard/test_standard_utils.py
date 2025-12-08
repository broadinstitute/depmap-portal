import pytest
from depmap.dataset.models import BiomarkerDataset
from depmap.interactive.standard import standard_utils
from depmap.interactive.common_utils import RowSummary
from loader import global_search_loader
from tests.factories import (
    GeneFactory,
    BiomarkerDatasetFactory,
    MatrixFactory,
    CellLineFactory,
)
from tests.utilities import interactive_test_utils

# standard get_matrix is tested in tests/.../interactive_utils


def test_get_all_row_indices_labels_entity_ids(empty_db_mock_downloads, app):
    """
    Test that
        gets all rowss
        with all fields expected (indices, labels, entity ids)
        works with and without entity class
    """
    gene_10 = GeneFactory(label="gene 10", entity_id=10)
    gene_20 = GeneFactory(label="gene 20", entity_id=20)

    dataset = BiomarkerDatasetFactory(
        matrix=MatrixFactory(
            entities=[gene_20, gene_10]
        ),  # different order from creation
        name=BiomarkerDataset.BiomarkerEnum.expression,
    )

    # creating another just to create more things to disambiguate, ensure that we are not selecting all
    BiomarkerDatasetFactory(
        matrix=MatrixFactory(entities=[GeneFactory()]),
        name=BiomarkerDataset.BiomarkerEnum.copy_number_relative,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected = [
        RowSummary(index=0, entity_id=20, label="gene 20"),
        RowSummary(index=1, entity_id=10, label="gene 10"),
    ]

    assert (
        standard_utils.get_all_row_indices_labels_entity_ids(dataset.name.name)
        == expected
    )
