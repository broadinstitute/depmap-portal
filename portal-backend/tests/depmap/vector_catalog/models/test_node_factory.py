import pytest
from depmap.vector_catalog.models import NodeFactory


def test_node_factory_constructor_checks():
    ## Not terminal
    # lacks children_category
    with pytest.raises(AssertionError):
        NodeFactory([], [], is_terminal=False, children_list_type="test")

    # lacks children_list_type
    with pytest.raises(AssertionError):
        NodeFactory([], [], is_terminal=False, children_category="test")

    ## Terminal
    # lacks get_slice_id method
    class TestNodeFactory1NoGetSliceId(NodeFactory):
        def get_attrs_from_slice_id(self):
            pass

    # lacks get_attrs_from_slice_id method
    class TestNodeFactory2NoGetAttrsFromSlice(NodeFactory):
        def get_slice_id(self):
            pass

    # has both
    class TestNodeFactory3(NodeFactory):
        def get_attrs_from_slice_id(self):
            pass

        def get_slice_id(self):
            pass

    with pytest.raises(AssertionError):
        TestNodeFactory1NoGetSliceId([], [], is_terminal=True)

    with pytest.raises(AssertionError):
        TestNodeFactory2NoGetAttrsFromSlice([], [], is_terminal=True)

    # has both implemented, but supplies children_list_type
    with pytest.raises(AssertionError):
        TestNodeFactory3([], [], is_terminal=True, children_list_type="test")

    # has both implemented, but supplies children_category
    with pytest.raises(AssertionError):
        TestNodeFactory3([], [], is_terminal=True, children_category="test")
