import pytest
import itertools
from loader import global_search_loader
from depmap.gene.models import Gene
from depmap.vector_catalog.nodes.continuous_tree.gene_nodes import (
    find_gene_ids_by_label_alias_prefix,
)


@pytest.mark.parametrize("prefix", [("s"), ("S")])
def test_find_gene_ids_by_label_alias_prefix(interactive_db_mock_downloads, prefix):
    """
    Tests path that looks up aliases using global search index
    Test for:
    Exact match for label or alias appears before partial matches
    i.e. for the search s, SWI5 appears before SOX10 despite SOX10 being first in alphabetical sort order, because SAE3 (alias of SWI5) is an alphabetically prior match
    Case insensitivity
    Alias order doesn't matter
    """
    global_search_loader.load_global_search_index()  # the query uses the global search index
    interactive_db_mock_downloads.session.flush()

    # THIS ORDER IS IMPORTANT. Be wary of changing the order; a change in order likely indicates that some functionality is broken. This is a list of gene labels, but we are checking that the function matches gene aliases
    expected_gene_labels = [
        "SWI5",
        "MEGF8",
        "MESP2",
        "MEG8",
        "SOX10",
        "SPACA9",
        "MEI1",
        "MEIG1",
        "MED20",
        "MED17",
    ]
    gene_ids = list(itertools.islice((find_gene_ids_by_label_alias_prefix(prefix)), 10))
    assert len(gene_ids) == len(expected_gene_labels)

    for gene_id, expected_label in zip(gene_ids, expected_gene_labels):
        assert Gene.get_by_id(gene_id).label == expected_label
