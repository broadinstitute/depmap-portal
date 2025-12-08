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


# standard without aliases is tested in test_interactive_utils


@pytest.mark.parametrize("prefix", [("s"), ("S")])
def test_get_label_aliases_starting_with(interactive_db_mock_downloads, prefix):
    """
    Tests path that looks up aliases using global search index
    Test for:
    Exact match for label or alias appears before partial matches
    i.e. for the search mettl2, SWI5 appears before SOX10 despite SOX10 being first in alphabetical sort order, because SAE3 (alias of SWI5) is an alphabetically prior match
    Case insensitivity
    Alias order doesn't matter
    """
    global_search_loader.load_global_search_index()  # the query uses the global search index
    interactive_db_mock_downloads.session.flush()

    # THIS ORDER IS IMPORTANT. Be wary of changing the order; a change in order likely indicates that some functionality is broken
    expected_list = [
        ("SWI5", {"bA395P17.9", "SAE3", "C9orf119"}),
        ("SOX10", {"DOM", "WS2E", "WS4"}),
    ]
    label_aliases_list = standard_utils._get_label_aliases_starting_with(
        "Avana", prefix, "gene"
    )
    assert len(label_aliases_list) == len(expected_list)
    print(label_aliases_list)
    for label_aliases, expected in zip(label_aliases_list, expected_list):
        assert label_aliases[0] == expected[0]
        assert set(label_aliases[1]) == expected[1]
