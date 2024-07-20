from depmap import data_access
from depmap.vector_catalog.models import (
    NodeFactory,
    SliceRowType,
    NodeType,
    SliceSerializer,
)
from depmap.entity.models import GenericEntity
from depmap.interactive import interactive_utils
from flask import g


class OtherNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=[],
            is_terminal=False,
            children_list_type=NodeType.static,
            children_category="dataset",
        )

    @staticmethod
    def get_all_other_datasets():
        """
        The problems with using some of our current cache methods for the child utils function are that:
            1) It performs the operation as an anonymous user which loses some permissions for accessing private datasets.
            2) Storing it as a global variable and retrieving it later could cause conflicts if 2 users make a request,
            potentially returning the value computed intended for one user to the other user.
        We don't have to worry about access control issues using flask g because the flask g attributes gets destroyed
        at the end of a person's request before the next person can make a request.
        """
        datasets = getattr(g, "get_all_other_datasets_cached", None)

        if datasets is None:
            g.get_all_other_datasets_cached = (
                interactive_utils.get_noncustom_continuous_datasets_not_gene_or_compound()
            )

        return g.get_all_other_datasets_cached

    def get_added_attrs(self):
        datasets = OtherNodeFactory.get_all_other_datasets()

        if len(datasets) > 0:
            # if there are options downstream, this node should exist
            return [{}]
        else:
            return []

    def create(self, tree_id_encoder, key):
        return self.create_node(
            tree_id_encoder, key, self.get_attrs(locals()), label="Other", value="other"
        )


class OtherDatasetNodeFactoryBase(NodeFactory):
    def __init__(self, is_prepopulate_branch, is_generic_entity):
        self.is_prepopulate_branch = is_prepopulate_branch
        self.is_generic_entity = is_generic_entity
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=[],
            added_attr_names=["dataset_id"],
            is_terminal=False,
            children_list_type=NodeType.static
            if self.is_prepopulate_branch
            else NodeType.dynamic,
            children_category=lambda attrs: interactive_utils.get_feature_name(
                attrs["dataset_id"]
            ),
        )

    def get_sort_key(self, dataset_id):
        """
        Sorts so that the metmap datasets are in the following order
            MetMap 125: Metastatic Potential
            MetMap 500: Metastatic Potential
            MetMap 500: Penetrance
        Not touching the sorting of the other datasets, because they actually seem to work out for usage, and the python sorting is stable
        """
        dataset_label = data_access.get_dataset_label(dataset_id)
        if dataset_label.lower().startswith("metmap"):
            return dataset_label
        return ""

    def get_added_attrs(self):
        datasets = OtherNodeFactory.get_all_other_datasets()
        if self.is_generic_entity:
            datasets = [
                dataset
                for dataset in datasets
                if interactive_utils.legacy_get_entity_class_name(dataset) is not None
            ]
        else:
            if self.is_prepopulate_branch:
                datasets = [
                    dataset
                    for dataset in datasets
                    if interactive_utils.is_prepopulate(dataset)
                    and interactive_utils.legacy_get_entity_class_name(dataset) is None
                ]
            else:
                datasets = [
                    dataset
                    for dataset in datasets
                    if not interactive_utils.is_prepopulate(dataset)
                    and interactive_utils.legacy_get_entity_class_name(dataset) is None
                ]

        return [dict(dataset_id=dataset_id) for dataset_id in datasets]

    def create(self, tree_id_encoder, key, dataset_id):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=data_access.get_dataset_label(dataset_id),
            value=dataset_id,
            url=interactive_utils.get_dataset_url(dataset_id),
            sort_key=self.get_sort_key(dataset_id),
        )


class OtherGenericEntityDatasetNonPrepopulateNodeFactory(OtherDatasetNodeFactoryBase):
    def __init__(self):
        is_prepopulate_branch = False
        is_generic_entity = True
        super().__init__(is_prepopulate_branch, is_generic_entity)


class OtherLabelDatasetPrepopulateNodeFactory(OtherDatasetNodeFactoryBase):
    def __init__(self):
        is_prepopulate_branch = True
        is_generic_entity = False
        super().__init__(is_prepopulate_branch, is_generic_entity)


class OtherLabelDatasetNonPrepopulateNodeFactory(OtherDatasetNodeFactoryBase):
    def __init__(self):
        is_prepopulate_branch = False
        is_generic_entity = False
        super().__init__(is_prepopulate_branch, is_generic_entity)


class OtherGenericEntityDatasetRowNonPrepopulateNodeFactory(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["dataset_id"],
            added_attr_names=["entity_id"],
            is_terminal=True,
        )

    def get_added_attrs(self, prefix, limit, dataset_id):
        entity_ids = interactive_utils.get_matching_row_entity_ids(
            dataset_id, prefix, limit
        )
        return [dict(entity_id=entity_id) for entity_id in entity_ids]

    def create(
        self, tree_id_encoder, key, dataset_id, entity_id,
    ):
        entity_label = GenericEntity.get_by_id(entity_id).label

        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=entity_label,
            value=entity_label,
        )

    def get_slice_id(self, attrs):
        return SliceSerializer.encode_slice_id(
            attrs["dataset_id"], attrs["entity_id"], SliceRowType.entity_id,
        )

    def get_attrs_from_slice_id(self, slice_id):
        """
        :param slice_id:
        :return: Tree Id if slice_id is valid for this node, else None
        """
        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(slice_id)
        if feature_type == SliceRowType.entity_id:
            all_datasets_in_other_branch = OtherNodeFactory.get_all_other_datasets()

            if dataset_id in all_datasets_in_other_branch:
                is_generic_entity = (
                    interactive_utils.legacy_get_entity_class_name(dataset_id)
                    == "generic_entity"
                )
                if is_generic_entity:
                    entity_id = int(feature)
                    return {"dataset_id": dataset_id, "entity_id": entity_id}

        return None


class NonEntityOtherDatasetRowNodeFactoryBase(NodeFactory):
    def __init__(self):
        NodeFactory.__init__(
            self,
            shared_parent_attr_names=["dataset_id"],
            added_attr_names=["row"],
            is_terminal=True,
        )

    def get_added_attrs(self):
        raise NotImplementedError

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
            all_datasets_in_other_branch = OtherNodeFactory.get_all_other_datasets()

            if dataset_id in all_datasets_in_other_branch:
                is_non_entity = (
                    interactive_utils.legacy_get_entity_class_name(dataset_id) is None
                )
                if is_non_entity:
                    return {"dataset_id": dataset_id, "row": feature}

        return None


class OtherLabelDatasetRowPrepopulateNodeFactory(
    NonEntityOtherDatasetRowNodeFactoryBase
):
    def get_added_attrs(self, dataset_id):
        """
        Subclass from base to set params of this function (no prefix and limit)
        """
        rows = interactive_utils.get_all_rows(dataset_id)
        return [dict(row=row["value"]) for row in rows]

    def get_attrs_from_slice_id(self, slice_id):
        attrs = super(
            OtherLabelDatasetRowPrepopulateNodeFactory, self
        ).get_attrs_from_slice_id(slice_id)
        if attrs and interactive_utils.is_prepopulate(attrs["dataset_id"]):
            return attrs
        return None


class OtherLabelDatasetRowNonPrepopulateNodeFactory(
    NonEntityOtherDatasetRowNodeFactoryBase
):
    def get_added_attrs(self, prefix, limit, dataset_id):
        """
        Subclass from base to set params of this function (prefix and limit)
        """
        rows = interactive_utils.get_matching_rows(dataset_id, prefix)
        return [dict(row=row["value"]) for row in rows]

    def get_attrs_from_slice_id(self, slice_id):
        attrs = super(
            OtherLabelDatasetRowNonPrepopulateNodeFactory, self
        ).get_attrs_from_slice_id(slice_id)
        if attrs and not interactive_utils.is_prepopulate(attrs["dataset_id"]):
            return attrs
        return None
