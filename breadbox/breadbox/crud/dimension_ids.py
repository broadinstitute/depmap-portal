import logging
from collections import defaultdict, namedtuple
from typing import Any, Dict, Optional, List, Type, Union, Tuple, Set, Collection
import warnings
from typing import Dict, List, Literal, Optional, Type, Union
from breadbox.models.dataset import DimensionTypeLabel
from .dimension_types import get_dimension_type_metadata_col

import pandas as pd
from sqlalchemy import and_, func, or_, select, true

from breadbox.db.session import SessionWithUser

from ..schemas.custom_http_exception import (
    ResourceNotFoundError,
    DatasetNotFoundError,
    FeatureNotFoundError,
    SampleNotFoundError,
)
from breadbox.models.dataset import (
    Dataset,
    MatrixDataset,
    TabularDataset,
    DatasetFeature,
    DatasetSample,
    TabularColumn,
    TabularCell,
    DimensionType,
)
from .dataset import assert_user_has_access_to_dataset, get_dataset


class GivenIDLabelIndex(pd.DataFrame):
    """ A subclass of DataFrame which is intended to enforce typesafety. Anywhere this type appears, you can be guaranteed that the required_columns are present. Similarly, there are @properties defined so you can make typesafe access to columns"""

    required_columns = ["given_id", "label", "index"]

    def __init__(self, *args, **kwargs):
        super(GivenIDLabelIndex, self).__init__(*args, **kwargs)
        self.set_index(["index"], drop=False, inplace=True)
        assert set(self.required_columns).issubset(self.columns)

    @property
    def label(self):
        return self["label"]

    @property
    def given_id(self):
        return self["given_id"]


class GivenIDLabelDataFrame(pd.DataFrame):
    """ A subclass of DataFrame which is intended to enforce typesafety. Anywhere this type appears, you can be guaranteed that the required_columns are present. Similarly, there are @properties defined so you can make typesafe access to columns"""

    required_columns = ["given_id", "label"]

    def __init__(self, *args, **kwargs):
        super(GivenIDLabelDataFrame, self).__init__(*args, **kwargs)
        assert set(self.required_columns).issubset(self.columns)
        self.set_index(["given_id"], drop=False, inplace=True)

    @property
    def label(self):
        return self["label"]

    @property
    def given_id(self):
        return self["given_id"]


class IndexedGivenIDDataFrame(pd.DataFrame):
    """ A subclass of DataFrame which is intended to enforce typesafety. Anywhere this type appears, you can be guarenteed that the required_columns are present. Similarly, there are @properties defined so you can make typesafe access to columns"""

    required_columns = ["given_id"]

    def __init__(self, source: pd.DataFrame):
        assert set(self.required_columns).issubset(source.columns)
        super(IndexedGivenIDDataFrame, self).__init__(source[self.required_columns])

    @property
    def given_id(self) -> pd.Series:
        column = self["given_id"]
        assert isinstance(column, pd.Series)
        return column


def get_dimension_type_labels_by_id(
    db: SessionWithUser, dimension_type_name: str, limit: Optional[int] = None
) -> dict[str, str]:
    """
    For a given dimension, get all IDs and labels that exist in the metadata.
    """
    return get_dimension_type_metadata_col(
        db, dimension_type_name, col_name="label", limit=limit
    )


def _populate_dimension_type_labels(db: SessionWithUser, dimension_type_name: str):
    label_by_given_id = get_dimension_type_labels_by_id(db, dimension_type_name)

    # first delete existing records
    db.query(DimensionTypeLabel).filter(
        DimensionTypeLabel.dimension_type_name == dimension_type_name
    ).delete()

    # now regenerate from scratch
    db.bulk_save_objects(
        [
            DimensionTypeLabel(
                dimension_type_name=dimension_type_name, label=label, given_id=given_id
            )
            for given_id, label in label_by_given_id.items()
        ]
    )
    db.flush()


def get_dimension_type_label_mapping_df(
    db: SessionWithUser,
    dimension_type_name: Optional[str],
    given_ids: Optional[Collection[str]] = None,
    labels: Optional[Collection[str]] = None,
) -> GivenIDLabelDataFrame:
    from breadbox.models.dataset import DimensionTypeLabel

    if dimension_type_name is None or dimension_type_name == "generic":
        if given_ids is not None:
            return GivenIDLabelDataFrame({"given_id": given_ids, "label": given_ids})
        elif labels is not None:
            return GivenIDLabelDataFrame({"given_id": labels, "label": labels})
        else:
            raise NotImplementedError(
                "Can't figure out the labels for a generic feature type"
            )

    query = db.query(DimensionTypeLabel).filter(
        DimensionTypeLabel.dimension_type_name == dimension_type_name
    )

    if given_ids is not None:
        query = query.filter(DimensionTypeLabel.given_id.in_(given_ids))

    if labels is not None:
        query = query.filter(DimensionTypeLabel.label.in_(labels))

    query = query.with_entities(DimensionTypeLabel.given_id, DimensionTypeLabel.label)
    return GivenIDLabelDataFrame(query.all(), columns=pd.Index(["given_id", "label"]))

    ##########################
    # from .dataset import get_metadata_used_in_matrix_dataset
    # from .dimension_types import get_dimension_type
    # dimension_type = get_dimension_type(db, dimension_type_name)
    # metadata_labels_by_given_id = get_metadata_used_in_matrix_dataset(
    #     db=db,
    #     dimension_type=dimension_type,
    #     matrix_dataset=dataset,
    #     dimension_subtype_cls=DatasetFeature,
    #     metadata_col_name="label",
    # )
    # if metadata_labels_by_given_id:
    #     return metadata_labels_by_given_id


def _get_matrix_dataset_index_id_mapping_df(
    db: SessionWithUser,
    dataset: MatrixDataset,
    axis: Type[Union[DatasetSample, DatasetFeature]],
    given_ids: Optional[Collection[str]] = None,
    indices: Optional[Collection[int]] = None,
) -> IndexedGivenIDDataFrame:

    assert_user_has_access_to_dataset(dataset, db.user)

    query = db.query(axis).filter(axis.dataset_id == dataset.id)

    if given_ids is not None:
        assert len(given_ids) == len(set(given_ids)), "Duplicate IDs present"
        query = query.filter(axis.given_id.in_(given_ids))

    if indices is not None:
        assert len(indices) == len(set(indices)), "Duplicate indices present"
        query = query.filter(axis.index.in_(indices))

    dataset_features = pd.DataFrame(
        query.with_entities(axis.given_id, axis.index).all(),
        columns=pd.Index(["given_id", "index"]),
    )
    dataset_features.set_index(["index"], drop=True, inplace=True)

    return IndexedGivenIDDataFrame(dataset_features)


def get_matrix_dataset_sample_df(
    db: SessionWithUser,
    dataset: MatrixDataset,
    filter_by_given_ids: Optional[Collection[str]],
) -> IndexedGivenIDDataFrame:
    return _get_matrix_dataset_index_id_mapping_df(
        db, dataset, DatasetSample, given_ids=filter_by_given_ids
    )


def get_matrix_dataset_features_df(
    db: SessionWithUser,
    dataset: MatrixDataset,
    filter_by_given_ids: Optional[Collection[str]],
) -> IndexedGivenIDDataFrame:
    return _get_matrix_dataset_index_id_mapping_df(
        db, dataset, DatasetFeature, given_ids=filter_by_given_ids
    )


def get_matrix_dataset_features(
    db: SessionWithUser, dataset: MatrixDataset
) -> list[DatasetFeature]:
    assert_user_has_access_to_dataset(dataset, db.user)

    dataset_features = (
        db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == dataset.id)
        .order_by(DatasetFeature.given_id)
        .all()
    )

    return dataset_features


def get_matrix_dataset_samples(
    db: SessionWithUser, dataset: MatrixDataset
) -> list[DatasetSample]:
    assert_user_has_access_to_dataset(dataset, db.user)

    dataset_samples = (
        db.query(DatasetSample)
        .filter(DatasetSample.dataset_id == dataset.id)
        .order_by(DatasetSample.given_id)
        .all()
    )

    return dataset_samples


def get_matrix_dataset_given_ids(
    db: SessionWithUser, dataset: Dataset, axis: str
) -> List[str]:
    assert_user_has_access_to_dataset(dataset, db.user)

    if axis == "feature":
        dimension_class = DatasetFeature
    elif axis == "sample":
        dimension_class = DatasetSample
    else:
        raise ValueError(f"Invalid axis: {axis}")

    given_ids = (
        db.query(dimension_class.given_id)
        .filter(dimension_class.dataset_id == dataset.id)
        .order_by(dimension_class.given_id)
        .all()
    )

    return [given_id for (given_id,) in given_ids]


def get_tabular_dataset_index_given_ids(
    db: SessionWithUser, dataset: TabularDataset
) -> list[str]:
    """
    Get all row given IDs belonging to a tabular dataset.
    This can be used for joining the metadata that's relevant for this particular dataset.
    Warning: this may contain given IDs that do not exist in the metadata.
    """
    dimension_type = (
        db.query(DimensionType).filter_by(name=dataset.index_type_name).one_or_none()
    )
    assert dimension_type is not None

    id_col_name = dimension_type.id_column
    cells_in_id_column = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(
            and_(
                TabularColumn.dataset_id == dataset.id,
                TabularColumn.given_id == id_col_name,
            )
        )
        .all()
    )
    return [cell.dimension_given_id for cell in cells_in_id_column]


def get_matching_feature_metadata_labels(
    db: SessionWithUser, feature_labels: List[str]
) -> set[str]:
    """
    DEPRECATED: this method should be removed when the old data_slicer functionality is replaced.
    Return the subset of the given list which matches any feature metadata label
    Use case-insensitive matching, but return a list of properly-cased labels.
    """
    lowercase_input_labels = [label.lower() for label in feature_labels]

    # Get all matching labels that exist in feature metadata
    matching_label_results = (
        db.query(DimensionType)
        .join(TabularDataset, DimensionType.dataset)
        .join(TabularColumn, TabularDataset.dimensions)
        .join(TabularCell, TabularColumn.tabular_cells)
        .filter(
            DimensionType.axis == "feature",
            TabularColumn.given_id == "label",
            func.lower(TabularCell.value).in_(lowercase_input_labels),
        )
        .with_entities(TabularCell.value)
        .all()
    )

    return {label for (label,) in matching_label_results}


def get_dataset_feature_by_uuid(
    db: SessionWithUser, user: str, dataset: Dataset, feature_uuid: str
) -> DatasetFeature:
    warnings.warn(
        "get_dataset_feature_by_uuid is deprecated and should only be used by legacy Elara functionality."
    )
    assert_user_has_access_to_dataset(dataset, user)

    feature = (
        db.query(DatasetFeature).filter(DatasetFeature.id == feature_uuid).one_or_none()
    )
    if feature is None:
        raise ResourceNotFoundError(
            f"Feature id '{feature_uuid}' not found in dataset '{dataset.id}' features."
        )
    assert feature.dataset_id == dataset.id

    return feature


def get_all_sample_indexes(
    db: SessionWithUser, user: str, dataset: MatrixDataset
) -> List[int]:
    df = _get_matrix_dataset_index_id_mapping_df(db, dataset, DatasetSample)
    return df.index.tolist()


IndicesAndMissing = namedtuple("IndicesAndMissing", "indices missing")


def get_feature_indexes_by_given_ids(
    db: SessionWithUser, user: str, dataset: MatrixDataset, given_ids: List[str]
) -> IndicesAndMissing:
    indexed_df = _get_matrix_dataset_index_id_mapping_df(
        db, dataset, DatasetFeature, given_ids
    )
    return IndicesAndMissing(
        indexed_df.index.tolist(), set(given_ids).difference(indexed_df.given_id)
    )


def get_sample_indexes_by_given_ids(
    db: SessionWithUser, user: str, dataset: MatrixDataset, given_ids: List[str]
) -> IndicesAndMissing:
    indexed_df = _get_matrix_dataset_index_id_mapping_df(
        db, dataset, DatasetSample, given_ids
    )
    return IndicesAndMissing(
        indexed_df.index.tolist(), set(given_ids).difference(indexed_df.given_id)
    )


def get_dataset_feature_by_given_id(
    db: SessionWithUser, dataset_id: str, feature_given_id: str,
) -> DatasetFeature:
    dataset = get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert_user_has_access_to_dataset(dataset, db.user)
    assert isinstance(dataset, MatrixDataset)

    feature = (
        db.query(DatasetFeature)
        .filter(
            DatasetFeature.given_id == feature_given_id,
            DatasetFeature.dataset_id == dataset.id,
        )
        .one_or_none()
    )

    if feature is None:
        raise FeatureNotFoundError(
            f"Feature given ID '{feature_given_id}' not found in dataset '{dataset_id}'."
        )
    return feature


def get_dataset_sample_by_given_id(
    db: SessionWithUser, dataset_id: str, sample_given_id: str,
) -> DatasetSample:
    dataset = get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")
    assert_user_has_access_to_dataset(dataset, db.user)
    assert isinstance(dataset, MatrixDataset)

    sample = (
        db.query(DatasetSample)
        .filter(
            DatasetSample.given_id == sample_given_id,
            DatasetSample.dataset_id == dataset.id,
        )
        .one_or_none()
    )

    if sample is None:
        raise SampleNotFoundError(
            f"Sample given ID '{sample_given_id}' not found in dataset '{dataset_id}'."
        )
    return sample
