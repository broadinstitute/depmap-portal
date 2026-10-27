import pandas as pd
import pytest
from sqlalchemy import literal, null, select

from breadbox.crud import dataset as dataset_crud
from breadbox.crud.dimension_ids import (
    get_dimension_type_labels_by_id,
    get_dimension_type_labels_by_id_fast,
)
from breadbox.db.session import SessionWithUser
from breadbox.db.util import fetch_columns_in_one_step
from breadbox.models.dataset import (
    Dimension,
    DimensionTypeLabel,
    TabularCell,
    TabularDataset,
)
from breadbox.schemas.custom_http_exception import DimensionTypeNotFoundError
from breadbox.schemas.types import AnnotationType
from breadbox.service.dataset import add_dimension_type

from tests import factories


@pytest.fixture
def labelled_type(minimal_db: SessionWithUser, settings):
    add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="thing",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "group": AnnotationType.text,
        },
        axis="feature",
        metadata_df=pd.DataFrame(
            {
                "ID": ["id3", "id1", "id2"],
                "label": ["Label 3", "Label 1", "Label 2"],
                "group": ["x", "y", "x"],
            }
        ),
    )
    return "thing"


def test_fast_labels_match_the_join(minimal_db: SessionWithUser, labelled_type):
    expected = get_dimension_type_labels_by_id(minimal_db, labelled_type)
    actual = get_dimension_type_labels_by_id_fast(minimal_db, labelled_type)

    assert expected  # the fixture really does have labels
    assert actual == expected
    assert list(actual) == list(expected)


def test_fast_labels_fall_back_when_not_precomputed(
    minimal_db: SessionWithUser, labelled_type
):
    minimal_db.query(DimensionTypeLabel).delete()
    minimal_db.flush()

    assert get_dimension_type_labels_by_id_fast(
        minimal_db, labelled_type
    ) == get_dimension_type_labels_by_id(minimal_db, labelled_type)


def test_fast_labels_respect_dataset_visibility(
    minimal_db: SessionWithUser, settings, labelled_type
):
    """The precomputed table has no group filtering of its own."""
    private = factories.group(minimal_db, settings)
    metadata_dataset = (
        minimal_db.query(TabularDataset).filter_by(index_type_name=labelled_type).one()
    )
    # Rows carry their own group_id, copied from the dataset when they are created.
    metadata_dataset.group_id = private.id
    minimal_db.query(Dimension).filter_by(dataset_id=metadata_dataset.id).update(
        {"group_id": private.id}
    )
    minimal_db.query(TabularCell).filter(
        TabularCell.tabular_column_id.in_(
            minimal_db.query(Dimension.id).filter_by(dataset_id=metadata_dataset.id)
        )
    ).update({"group_id": private.id}, synchronize_session=False)
    minimal_db.flush()

    minimal_db.reset_user("someone-without-access@example.com")

    assert get_dimension_type_labels_by_id(minimal_db, labelled_type) == {}
    assert get_dimension_type_labels_by_id_fast(minimal_db, labelled_type) == {}


def test_fast_labels_for_type_without_metadata(
    minimal_db: SessionWithUser, settings,
):
    add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="bare",
        id_column="ID",
        annotation_type_mapping={"ID": AnnotationType.text},
        axis="feature",
    )
    assert get_dimension_type_labels_by_id_fast(minimal_db, "bare") == {}


def test_fast_labels_unknown_type(minimal_db: SessionWithUser):
    with pytest.raises(DimensionTypeNotFoundError):
        get_dimension_type_labels_by_id_fast(minimal_db, "no-such-type")


def test_single_column_read_matches_pivot(minimal_db: SessionWithUser, labelled_type):
    dataset = (
        minimal_db.query(TabularDataset).filter_by(index_type_name=labelled_type).one()
    )

    both = dataset_crud.get_subset_of_tabular_data_as_df(
        minimal_db, dataset, column_names=["label", "group"], index_given_ids=None
    )
    single = dataset_crud.get_subset_of_tabular_data_as_df(
        minimal_db, dataset, column_names=["group"], index_given_ids=None
    )

    pd.testing.assert_frame_equal(single, both[["group"]])


def test_single_column_read_with_no_matching_rows(
    minimal_db: SessionWithUser, labelled_type
):
    dataset = (
        minimal_db.query(TabularDataset).filter_by(index_type_name=labelled_type).one()
    )

    result = dataset_crud.get_subset_of_tabular_data_as_df(
        minimal_db, dataset, column_names=["group"], index_given_ids=["nope"]
    )
    assert result.empty


def test_fetch_columns_in_one_step_returns_columns_in_row_order(
    minimal_db: SessionWithUser, labelled_type
):
    ids, labels = fetch_columns_in_one_step(
        minimal_db.connection(),
        select(DimensionTypeLabel.given_id, DimensionTypeLabel.label)
        .where(DimensionTypeLabel.dimension_type_name == labelled_type)
        .order_by(DimensionTypeLabel.id),
    )
    assert dict(zip(ids, labels)) == get_dimension_type_labels_by_id(
        minimal_db, labelled_type
    )
    assert ids == list(get_dimension_type_labels_by_id(minimal_db, labelled_type))


def test_fetch_columns_in_one_step_round_trips_awkward_values(
    minimal_db: SessionWithUser,
):
    values = [
        ('quote"s', None),
        ("new\nline\ttab", "caf\u00e9 \u2603"),
        ("back\\slash", ""),
        ("1", "2.50"),  # numeric-looking text must stay text
    ]
    minimal_db.add_all(
        DimensionTypeLabel(
            dimension_type_name="depmap_model", given_id=g, label=l or "x"
        )
        for g, l in values
    )
    minimal_db.flush()
    ids, labels = fetch_columns_in_one_step(
        minimal_db.connection(),
        select(DimensionTypeLabel.given_id, DimensionTypeLabel.label)
        .where(DimensionTypeLabel.given_id.in_([g for g, _ in values]))
        .order_by(DimensionTypeLabel.id),
    )
    assert ids == [g for g, _ in values]
    assert labels == [l or "x" for _, l in values]


def test_fetch_columns_in_one_step_keeps_nulls_aligned(minimal_db: SessionWithUser):
    rows = select(literal("a").label("id"), literal("present").label("note")).union_all(
        select(literal("b"), null()), select(literal("c"), literal("present"))
    )
    ids, notes = fetch_columns_in_one_step(minimal_db.connection(), rows)

    assert ids == ["a", "b", "c"]
    assert notes == ["present", None, "present"]


def test_fetch_columns_in_one_step_empty_result(
    minimal_db: SessionWithUser, labelled_type
):
    ids, labels = fetch_columns_in_one_step(
        minimal_db.connection(),
        select(DimensionTypeLabel.given_id, DimensionTypeLabel.label).where(
            DimensionTypeLabel.dimension_type_name == "no-such-type"
        ),
    )
    assert ids == [] and labels == []


def test_single_column_read_matches_pivot_with_nulls_and_row_subset(
    minimal_db: SessionWithUser, settings
):
    add_dimension_type(
        minimal_db,
        settings,
        user=settings.admin_users[0],
        name="gappy",
        id_column="ID",
        annotation_type_mapping={
            "ID": AnnotationType.text,
            "label": AnnotationType.text,
            "note": AnnotationType.text,
        },
        axis="feature",
        metadata_df=pd.DataFrame(
            {
                "ID": ["z", "a", "m", "b"],
                "label": ["Z", "A", "M", "B"],
                "note": ["n1", None, "n3", "n4"],
            }
        ),
    )
    dataset = minimal_db.query(TabularDataset).filter_by(index_type_name="gappy").one()

    for ids in (None, ["m", "z", "nope"]):
        both = dataset_crud.get_subset_of_tabular_data_as_df(
            minimal_db, dataset, column_names=["label", "note"], index_given_ids=ids
        )
        single = dataset_crud.get_subset_of_tabular_data_as_df(
            minimal_db, dataset, column_names=["note"], index_given_ids=ids
        )
        pd.testing.assert_frame_equal(single, both[["note"]])
        assert list(single.index) == sorted(single.index)
