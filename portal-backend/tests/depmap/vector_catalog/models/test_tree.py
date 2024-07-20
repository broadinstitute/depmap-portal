import pytest
from depmap.vector_catalog.models import (
    Tree,
    NodeTemplate,
    NodeType,
    Node,
    NodeFactory,
    SingleNodeFactory,
)
from tests.depmap.utilities.test_tree_utils import (
    TerminalTestNodeFactory,
    TwoOptionTestNodeFactory,
)


# helper test classes
class DynamicTestNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["option_id"],
            added_attr_names=["dynamic_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="test",
        )

    def get_added_attrs(self, prefix, limit):
        return [{"dynamic_id": prefix}]

    def create(self, tree_id_encoder, key, dynamic_id, option_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=dynamic_id,
            value=dynamic_id,
        )


class BranchATerminalNodeFactory(
    NodeFactory
):  # will trigger pytest complaints if name starts with Test
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["option_id", "dynamic_id"],
            added_attr_names=[],
            is_terminal=True,
        )

    def get_slice_id(self, attrs):
        return "slice/level_3a/test/test"

    def get_attrs_from_slice_id(self, slice_id):
        if "level_3a" in slice_id:
            return {"option_id": 1, "dynamic_id": "a"}
        else:
            return None

    def create(self, tree_id_encoder, key, option_id, dynamic_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=dynamic_id + str(option_id),
            value=dynamic_id + str(option_id),
        )


branches = NodeTemplate(
    "root",
    SingleNodeFactory(
        "root",
        is_terminal=False,
        value="root",
        children_list_type=NodeType.static,
        children_category="type",
    ),
    [
        NodeTemplate(
            "level_1a",
            TwoOptionTestNodeFactory(
                is_terminal=False,
                children_list_type=NodeType.dynamic,
                children_category="test",
            ),
            [
                NodeTemplate(
                    "level_2a",
                    DynamicTestNodeFactory(),
                    children=[NodeTemplate("level_3a", BranchATerminalNodeFactory())],
                )
            ],
        ),
        NodeTemplate(
            "level_1b",
            SingleNodeFactory(
                "level_1b",
                is_terminal=False,
                value="level_1b",
                children_list_type=NodeType.static,
                children_category="type",
            ),
            children=[
                NodeTemplate(
                    "level_2b_invisible",
                    SingleNodeFactory(
                        "level_2b_invisible",
                        is_terminal=False,
                        value="level_2b_invisible",
                        children_list_type=NodeType.static,
                        children_category="type",
                    ),
                    visible_from_parent=False,
                    children=[
                        NodeTemplate(
                            "level_3b",
                            TerminalTestNodeFactory("level_3b", value="level_3b"),
                        )
                    ],
                ),
                # NodeTemplate("level_2b_visible", TerminalTestNodeFactory("level_2b_visible", value="level_2b_visible")),
            ],
        ),
    ],
)

attr_types = {"option_id": int, "dynamic_id": str}

tree = Tree(branches, attr_types)


# the actual tests


def test_constructor_detects_duplicate_keys():
    """
    Light test that constructor detects duplicate node template keys
    """
    duplicate_key_branches = NodeTemplate(
        "root",
        SingleNodeFactory(
            "root",
            is_terminal=False,
            value="root",
            children_list_type=NodeType.static,
            children_category="type",
        ),
        [
            NodeTemplate(
                "duplicate", TerminalTestNodeFactory("duplicate", value="duplicate")
            ),
            NodeTemplate(
                "duplicate", TerminalTestNodeFactory("duplicate", value="duplicate")
            ),
        ],
    )
    with pytest.raises(AssertionError):
        Tree(duplicate_key_branches, {})


def test_get_children():
    """
    Very sparse test
    Tests that
        Returns list of children across multiple node templates
        Returns created Nodes
        Does not return invisible children
    """
    children = tree.get_children("root")
    assert len(children) == 3
    assert all([isinstance(child, Node) for child in children])

    # should not return invisible children
    children = tree.get_children("level_1b")  # fixme check if this works
    assert children == []


def test_get_parent():
    """
    Very sparse test
    Test that
        returned parent is the correct created Node
        works even when the parent is a dynamic node
    """
    child_key = "level_2a"
    child_attrs = {"option_id": 1, "dynamic_id": "a"}

    node = tree.get_parent(child_key, child_attrs)
    assert isinstance(node, Node)
    assert node.key == "level_1a"


def test_get_path_to_node():
    """
    Test that expected list of nodes retrieved for
        normal, terminal node
        intermediate node not visible from parent
        terminal node, where the path to the parent contains a node invisible to its parent
    """
    slice_id = "slice/level_3a/test/test"
    path_a = tree.get_path_to_node(slice_id)
    path_a_expected_keys = ["root", "level_1a", "level_2a", "level_3a"]

    assert len(path_a) == len(path_a_expected_keys)
    assert [node.key for node in path_a] == path_a_expected_keys

    # works for an node not visible from parent
    path_b_2 = tree.get_path_to_node("level_2b_invisible")
    path_b_2_expected_keys = ["root", "level_1b", "level_2b_invisible"]
    assert [node.key for node in path_b_2] == path_b_2_expected_keys

    # works for a node that is a child of a node not visible from parent
    path_b_3 = tree.get_path_to_node("slice/level_3b/test/test")
    path_b_3_expected_keys = ["root", "level_1b", "level_2b_invisible", "level_3b"]
    assert [node.key for node in path_b_3] == path_b_3_expected_keys


def test_create_node_from_slice_id_detects_duplicate_matches():
    """
    TerminalTestNodeFactory is set up so that it 'recognizes' the slice id if the node factory label is contained in the slice id
    :return:
    """
    # TerminalTestNodeFactory is set up so that it 'recognizes' the slice id if the node factory label is contained in the slice id
    node_factory_1 = TerminalTestNodeFactory(
        "test_dataset",  # thus, by giving the same label, both nodes will accept the slice id
        value="node 1",
    )
    node_factory_2 = TerminalTestNodeFactory("test_dataset", value="node 2")
    multiple_slice_id_matches_branches = NodeTemplate(
        "root",
        SingleNodeFactory(
            "root",
            is_terminal=False,
            value="root",
            children_list_type=NodeType.static,
            children_category="type",
        ),
        [
            NodeTemplate("node 1", node_factory_1),
            NodeTemplate("node 2", node_factory_2),
        ],
    )

    # test setup, get slice id and verify that the two are the same
    slice_id = node_factory_1.get_slice_id(
        {}
    )  # for this TerminalTestNodeFactory, attrs are ignored
    assert slice_id == node_factory_2.get_slice_id({})

    # test setup, verify that both will accept
    assert node_factory_1.get_attrs_from_slice_id(slice_id) is not None
    assert node_factory_2.get_attrs_from_slice_id(slice_id) is not None

    # verify that we get an error
    tree = Tree(multiple_slice_id_matches_branches, {})
    with pytest.raises(AssertionError):
        tree._create_node_from_slice_id(slice_id)
