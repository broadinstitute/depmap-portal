from typing import Iterable, Union

from sqlalchemy.orm.exc import NoResultFound
from depmap.interactive import interactive_utils
from depmap.vector_catalog.models import (
    SliceRowType,
    SliceSerializer,
)

OTHER_DATASET_NON_PREPOPULATE_ID_BASE = "other_label_dataset_non_prepopulate"


class InteractiveTree:
    @staticmethod
    def get_dataset_feature_from_id(id):
        """Given a feature's slice ID, Get the dataset ID and feature's entity class."""
        if id is None or id == "":
            return id, id

        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(id)

        if feature_type == SliceRowType.entity_id:
            entity_class = interactive_utils.get_entity_class(dataset_id)
            assert entity_class is not None
            feature = entity_class.get_by_id(int(feature)).label
        return dataset_id, feature

    @staticmethod
    def get_id_from_dataset_feature(
        dataset: str, feature: Union[str, int], feature_is_entity_id=False
    ):
        return InteractiveTree.get_ids_from_dataset_features(
            dataset, [feature], feature_is_entity_id
        )[0]

    @staticmethod
    def get_ids_from_dataset_features(
        dataset: str, features: Iterable[Union[str, int]], feature_is_entity_id=False
    ):
        """
        For features with entity id, this function will be faster if providing entity id.
        ^^ The above comment claims this, but I have a hard time believing this looking at the implementation.
        As far as I can tell, the behavior is identical regardless of the value of feature_is_entity_id. A
        cleanup that might be worth attempting is removing that flag and seeing if anything changes.

        This method is designed to speed up instances where we need to make a lot of ids within the same dataset
        """
        if dataset == "":
            # escape hatch for existing tests
            return ["" for _ in features]

        row_type = SliceRowType.label

        if feature_is_entity_id:
            row_type = SliceRowType.entity_id

        # This check is to accommodate the interactive config hack for mutations_prioritized. See depmap/interactive/config/models.py::_get_standard_datasets
        # mutations_prioritized is a biomarker which is currently defaulted to be defined there as continuous but we actually want it to be categorical
        # TODO: Make mutations_prioritized interactive config nonambiguous and move it to a categorical config.
        elif interactive_utils.is_categorical(dataset):
            row_type = SliceRowType.label
        # get_entity_class does not work on categorical/binary datasets
        elif interactive_utils.is_continuous(dataset):
            entity_class = interactive_utils.get_entity_class(dataset)
            if entity_class:
                try:
                    features = [
                        entity_class.get_by_label(feature).entity_id
                        for feature in features
                    ]
                except NoResultFound as e:
                    raise Exception(
                        "Could not find {} with label {}. get_by_label may not be implemented on {}".format(
                            entity_class, features, entity_class
                        )
                    ) from e
                row_type = SliceRowType.entity_id

        return [
            SliceSerializer.encode_slice_id(dataset, feature, row_type)
            for feature in features
        ]
