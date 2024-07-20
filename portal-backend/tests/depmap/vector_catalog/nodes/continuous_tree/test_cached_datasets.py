from depmap.vector_catalog.nodes.continuous_tree.other_nodes import OtherNodeFactory
from depmap.interactive import interactive_utils


def test_get_all_other_datasets(monkeypatch, app):
    """
    Use monkeypatch to intercept during runtime and mock functionality of the utils function 
    get_custom_continuous_datasets_not_gene_or_compound
    to test whether flask g is actually caching. We expect the function in question to be called only once
    even though its parent function has been called multiple times. 
    The mock function is a simple counter updater to check how many times it has been called.
    """
    count = 0

    def mockFunction():
        nonlocal count
        count += 1
        print(count)
        return []

    monkeypatch.setattr(
        interactive_utils,
        "get_noncustom_continuous_datasets_not_gene_or_compound",
        mockFunction,
    )

    with app.test_request_context():
        OtherNodeFactory.get_all_other_datasets()
        assert count == 1
        OtherNodeFactory.get_all_other_datasets()
        assert count == 1
