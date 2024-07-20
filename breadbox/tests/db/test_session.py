from breadbox.db.session import SessionWithUser
from breadbox.crud.access_control import PUBLIC_GROUP_ID
from breadbox.crud.group import (
    add_group,
    add_group_entry,
)
from breadbox.config import Settings
from breadbox.db.session import SessionLocalWithUser
from breadbox.models.dataset import MatrixDataset, DatasetFeature
from breadbox.schemas.group import GroupIn, GroupEntryIn, AccessType

from tests import factories


def test_session_with_user(
    client, db_path, minimal_db: SessionWithUser, settings: Settings, monkeypatch
):
    admin_user = settings.admin_users[0]
    private_access_user = "PrivateAccessUser"
    unknown_user = "NoAccessHere"

    # Make a private group and one private dataset
    private_group = add_group(
        minimal_db, admin_user, group_in=GroupIn(name="private_group")
    )
    private_group_entry = GroupEntryIn(
        email=private_access_user, access_type=AccessType.read
    )
    add_group_entry(minimal_db, admin_user, private_group, private_group_entry)

    private_dataset = factories.matrix_dataset(
        minimal_db, settings, group=private_group.id,
    )

    public_dataset = factories.matrix_dataset(
        minimal_db, settings, group=PUBLIC_GROUP_ID,
    )
    minimal_db.commit()

    # A session with the admin user should have access to everything
    admin_db = SessionLocalWithUser(admin_user)
    admin_visible_datasets = admin_db.query(MatrixDataset).all()
    assert len(admin_visible_datasets) == 2
    admin_visible_private_dataset_features = (
        admin_db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == private_dataset.id)
        .all()
    )
    assert len(admin_visible_private_dataset_features) > 0

    # A session with the private access user should have access to everything
    private_user_db = SessionLocalWithUser(private_access_user)
    privately_visible_datasets = private_user_db.query(MatrixDataset).all()
    assert len(privately_visible_datasets) == 2
    privately_visible_private_dataset_features = (
        private_user_db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == private_dataset.id)
        .all()
    )
    assert len(privately_visible_private_dataset_features) > 0

    # A session with the unknown user should only have access to the public dataset and features
    public_user_db = SessionLocalWithUser(unknown_user)
    publically_visible_datasets = public_user_db.query(MatrixDataset).all()
    assert len(publically_visible_datasets) == 1
    assert publically_visible_datasets[0].id == public_dataset.id

    publically_visible_private_dataset_features = (
        public_user_db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == private_dataset.id)
        .all()
    )
    assert len(publically_visible_private_dataset_features) == 0

    publically_visible_public_dataset_features = (
        public_user_db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == public_dataset.id)
        .all()
    )
    assert len(publically_visible_public_dataset_features) > 0
