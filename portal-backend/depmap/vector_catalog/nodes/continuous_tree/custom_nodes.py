from depmap.interactive import interactive_utils
from depmap.vector_catalog.models import (
    NodeFactory,
    SliceSerializer,
    SliceRowType,
    NodeType,
)
from depmap.interactive.nonstandard import nonstandard_utils


class CustomDatasetNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["dataset_id"],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="feature",
        )

    def get_added_attrs(self):
        # should not be visible from the parent, should not be able to create all custom dataset nodes
        raise ValueError(
            "Unexpected call to CustomDatasetNodeFactory.get_added_attrs, should not be able to ask for all the custom datasets."
        )

    def create(self, tree_id_encoder, key, dataset_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=interactive_utils.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
        )


class CustomDatasetRowNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["dataset_id"],
            added_attr_names=["row"],
            is_terminal=True,
        )

    def get_added_attrs(self, dataset_id):
        """
        This separation from the create method, passing this into the create method, ensures that we add to the attrs the entire space of things necessary to specify to create a node
        Ignore prefix and limit
        """
        rows = nonstandard_utils.get_matching_rows(dataset_id, "")
        return [dict(row=row["value"]) for row in rows]

    def create(self, tree_id_encoder, key, row, dataset_id):
        return self.create_node(
            tree_id_encoder, key, self.get_attrs(locals()), label=row, value=row
        )

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["row"], SliceRowType.label
        )

    def get_attrs_from_slice_id(self, slice_id):
        """

        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)

        if feature_type == SliceRowType.label:
            if interactive_utils.is_custom(dataset_id):
                return {"dataset_id": dataset_id, "row": feature}

        return None
