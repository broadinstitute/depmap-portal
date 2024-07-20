from depmap.vector_catalog.models import SingleNodeFactory, NodeFactory


class TerminalTestNodeFactory(
    SingleNodeFactory
):  # will trigger pytest complaints if name starts with Test
    def __init__(
        self,
        label,
        value,
        children_list_type=None,
        children_category=None,
        url=None,
        group=None,
        parent_attr_names=[],
        attrs_from_slice_id=None,
    ):
        is_terminal = True
        super().__init__(
            label,
            is_terminal,
            value,
            children_list_type,
            children_category,
            url,
            group,
            parent_attr_names,
        )
        self.attrs_from_slice_id = (
            {} if attrs_from_slice_id is None else attrs_from_slice_id
        )

    def get_slice_id(self, attrs):
        return "slice/{}/test/test".format(self.label)

    def get_attrs_from_slice_id(self, slice_id):
        if self.label in slice_id:
            return {}
        else:
            return None


class TwoOptionTestNodeFactory(NodeFactory):
    def __init__(self, is_terminal, children_list_type=None, children_category=None):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["option_id"],
            is_terminal=is_terminal,
            children_list_type=children_list_type,
            children_category=children_category,
        )

    def get_added_attrs(self):
        """
        We cannot just use interactive util's get_matching_rows, because that requires a dataset
        """
        return [dict(option_id=option_id) for option_id in [1, 2]]

    def create(self, tree_id_encoder, key, option_id):
        id_to_value = {1: "one", 2: "two"}
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=id_to_value[option_id],
            value=id_to_value[option_id],
        )
