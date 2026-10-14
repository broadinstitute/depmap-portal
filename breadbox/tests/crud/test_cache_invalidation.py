import pytest

from breadbox.crud import dataset as dataset_crud
from breadbox.crud import dimension_types as types_crud
from breadbox.crud import group as group_crud
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from breadbox.crud.cache_invalidation import (
    ALL_CACHE_KEYS,
    DIMENSION_TYPES,
    GET_DATASETS,
    GET_DATASETS_PUBLIC,
    get_cache_versions,
    invalidate_cache_keys,
)
from breadbox.schemas.dataset import MatrixDatasetUpdateParams
from breadbox.schemas.group import GroupEntryIn
from breadbox.models.group import AccessType

from tests import factories


@pytest.fixture
def admin_db(minimal_db, settings):
    minimal_db.reset_user(settings.admin_users[0])
    return minimal_db


def _versions(db):
    return get_cache_versions(db, ALL_CACHE_KEYS)


def _changed_keys(before, after):
    return {key for key in before if before[key] != after[key]}


def test_never_invalidated_key_has_empty_version(admin_db):
    assert get_cache_versions(admin_db, ["no-such-key"]) == {"no-such-key": ""}


def test_invalidate_cache_keys_only_changes_given_keys(admin_db):
    before = _versions(admin_db)
    invalidate_cache_keys(admin_db, GET_DATASETS)
    invalidate_cache_keys(admin_db, GET_DATASETS)
    after = _versions(admin_db)
    assert _changed_keys(before, after) == {GET_DATASETS}


def test_adding_transient_dataset_invalidates_nothing(admin_db, settings):
    before = _versions(admin_db)
    dataset = factories.matrix_dataset(admin_db, settings, is_transient=True)
    assert _versions(admin_db) == before

    # nor does deleting it
    dataset_crud.delete_dataset(
        admin_db, settings.admin_users[0], dataset, settings.filestore_location
    )
    assert _versions(admin_db) == before


def test_adding_public_dataset_invalidates_both_dataset_keys(admin_db, settings):
    before = _versions(admin_db)
    factories.matrix_dataset(admin_db, settings)
    assert _changed_keys(before, _versions(admin_db)) == {
        GET_DATASETS,
        GET_DATASETS_PUBLIC,
    }


def test_adding_private_dataset_only_invalidates_get_datasets(admin_db, settings):
    group = factories.group(admin_db, settings)
    before = _versions(admin_db)
    factories.matrix_dataset(admin_db, settings, group=group.id)
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}


def test_updating_and_deleting_datasets(admin_db, settings):
    user = settings.admin_users[0]
    private_group = factories.group(admin_db, settings)
    private_dataset = factories.matrix_dataset(
        admin_db, settings, group=private_group.id
    )

    # a change to a private dataset doesn't affect the public key
    before = _versions(admin_db)
    dataset_crud.update_dataset(
        admin_db,
        user,
        private_dataset,
        MatrixDatasetUpdateParams(format="matrix", name="renamed"),
    )
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}

    # moving it into the public group affects the public key
    before = _versions(admin_db)
    dataset_crud.update_dataset(
        admin_db,
        user,
        private_dataset,
        MatrixDatasetUpdateParams(format="matrix", group_id=PUBLIC_GROUP_ID),
    )
    assert _changed_keys(before, _versions(admin_db)) == {
        GET_DATASETS,
        GET_DATASETS_PUBLIC,
    }

    # ... and so does moving it back out (the group it left must be invalidated)
    before = _versions(admin_db)
    dataset_crud.update_dataset(
        admin_db,
        user,
        private_dataset,
        MatrixDatasetUpdateParams(format="matrix", group_id=private_group.id),
    )
    assert _changed_keys(before, _versions(admin_db)) == {
        GET_DATASETS,
        GET_DATASETS_PUBLIC,
    }

    # deleting a private dataset only affects the general key
    before = _versions(admin_db)
    dataset_crud.delete_dataset(
        admin_db, user, private_dataset, settings.filestore_location
    )
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}


def test_group_changes_invalidate_get_datasets_only(admin_db, settings):
    user = settings.admin_users[0]

    before = _versions(admin_db)
    group = group_crud.add_group(
        admin_db, user, factories.GroupIn(name=factories.unique_name("g"))
    )
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}

    before = _versions(admin_db)
    entry = group_crud.add_group_entry(
        admin_db,
        user,
        group,
        GroupEntryIn(
            email="someone@sample.com", access_type=AccessType.read, exact_match=True
        ),
    )
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}

    before = _versions(admin_db)
    group_crud.delete_group_entry(admin_db, user, entry.id)
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}

    before = _versions(admin_db)
    group_crud.delete_group(admin_db, user, group)
    assert _changed_keys(before, _versions(admin_db)) == {GET_DATASETS}


def test_dimension_type_changes_invalidate_dimension_types(admin_db, settings):
    before = _versions(admin_db)
    dimension_type = types_crud.add_dimension_type(
        admin_db, name="new_type", id_column="id", axis="feature"
    )
    assert _changed_keys(before, _versions(admin_db)) == {
        DIMENSION_TYPES,
        GET_DATASETS,
    }

    before = _versions(admin_db)
    types_crud.delete_dimension_type(admin_db, dimension_type)
    assert _changed_keys(before, _versions(admin_db)) == {
        DIMENSION_TYPES,
        GET_DATASETS,
    }
