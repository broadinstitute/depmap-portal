from typing import Optional, Union
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from breadbox.crud.access_control import (
    user_has_access_to_group,
    user_can_view_group_contents,
    TRANSIENT_GROUP_ID,
)
from breadbox.db.session import SessionWithUser
from breadbox.models.group import AccessType, Group, GroupEntry
from breadbox.models.dataset import Dataset

from breadbox.schemas.group import GroupIn, GroupEntryIn
from breadbox import config
from breadbox.schemas.custom_http_exception import (
    GroupPermissionError,
    UserError,
    GroupHasDatasetsError,
    ExistingResourceNameError,
)


def get_visible_groups(
    db: SessionWithUser, user: str, write_access: bool = False,
) -> list[Group]:
    """
    Get all groups that the given user has access to. Admins have access to groups that 
    they're not a part of, even though they can't see datasets belonging to those groups.
    No users should be able to view the transient group.
    """
    assert (
        db.user == user
    ), f"User parameter '{user}' must match the user set on the database session '{db.user}'"

    all_groups = db.query(Group).all()

    # Filter out transient group and groups user don't have access to in response
    groups = [
        group
        for group in all_groups
        if user_has_access_to_group(group, user, write_access)
        and group.id != TRANSIENT_GROUP_ID
    ]

    return groups


def get_groups_with_visible_contents(db: SessionWithUser, user: str) -> list[Group]:
    """
    Gets all groups for which a user can view the datasets and other contents.
    This is used for situations where we don't want data to be discoverable by users. 
    For example,
    - No users can view the list of all transient datasets, but anyone can read a transient dataset that they know the ID of.
    - Admins can view/edit access controls for private groups but can't view datasets belonging to private groups they're not in. 
    """
    visible_groups = get_visible_groups(db, user)
    return [
        group for group in visible_groups if user_can_view_group_contents(group, user)
    ]


def get_group_by_name(
    db: SessionWithUser, user: str, group_name: str, write_access: bool = False
):
    assert (
        db.user == user
    ), f"User parameter '{user}' must match the user set on the database session '{db.user}'"
    group = db.query(Group).filter(Group.name == group_name).one_or_none()
    if group is None:
        return None

    if not user_has_access_to_group(group, user, write_access):
        return None

    return group


def get_transient_group(db: Session):
    """Retrieve the transient group. This doesn't have any access control checks because this group
    is intended for anyone to add to"""
    group = db.query(Group).get(TRANSIENT_GROUP_ID)
    assert group is not None
    return group


def get_group(
    db: SessionWithUser,
    user: str,
    group_id: Union[str, UUID],
    write_access: bool = False,
) -> Optional[Group]:
    assert (
        db.user == user
    ), f"User parameter '{user}' must match the user set on the database session '{db.user}'"
    if isinstance(group_id, UUID):
        group_id = str(group_id)

    group = db.query(Group).get(group_id)
    if group is None:
        return None

    if not user_has_access_to_group(group, user, write_access):
        return None

    return group


def add_group(db: SessionWithUser, user: str, group_in: GroupIn, id=None):
    """Create a new access group.

    Also adds a GroupEntry with write permissions for the user creating the group,
    so at least one user can

    If the ID should be a hardcoded UUID value pass it in via "id" parameter.
    id should be a UUID as GroupOut expects to return id as a UUID
    """
    group = Group(name=group_in.name)
    if id is not None:
        group.id = id
    try:
        db.add(group)
        db.flush()
    except IntegrityError as e:
        raise ExistingResourceNameError(f"'{group_in.name}' already exists!")

    group_entry = GroupEntry(
        group=group, access_type=AccessType.owner, email=user, exact_match=True
    )
    db.add(group_entry)

    db.flush()
    return group


def delete_group(db: SessionWithUser, user: str, group: Group):
    """
    Only a user with write access can delete group.
    Deletes group including all the group entries within the group and datasets owned by the group.
    NOTE: If a user with write access deletes group, all entries including admin entry can be deleted. This is to support the use case that a group might not have an admin group entry
    """
    if not user_has_access_to_group(group, user, write_access=True):
        raise GroupPermissionError("User does not have permission to delete this group")

    datasets_in_group = db.query(Dataset).filter(Dataset.group_id == group.id)
    if len(datasets_in_group.all()) > 0:
        print("raising")
        raise GroupHasDatasetsError("Cannot delete group because there are datasets")

    db.query(GroupEntry).filter(GroupEntry.group_id == group.id).delete()
    print("deleting")
    db.delete(group)

    db.flush()

    return True


def add_group_entry(
    db: SessionWithUser, user: str, group: Group, group_entry_in: GroupEntryIn
):
    if not user_has_access_to_group(group, user, write_access=True):
        raise GroupPermissionError(
            "User does not have write permissions for this group"
        )

    # if there's already an entry for this email, overwrite it by deleting/adding it
    db.query(GroupEntry).filter_by(group=group, email=group_entry_in.email).delete()

    # now, add the new entry
    group_entry = GroupEntry(
        group=group,
        access_type=group_entry_in.access_type,
        email=group_entry_in.email,
        exact_match=group_entry_in.exact_match,
    )

    db.add(group_entry)
    db.flush()
    return group_entry


def delete_group_entry(db: SessionWithUser, user: str, group_entry_id: str):
    """
    Deletes group entry if user has write permissions for the group.
    If group entry doesn't exist, return None.
    Only an admin can delete its own group entry.
    NOTE: However, if a user with write access deletes group, all entries including admin entry can be deleted.
    NOTE: A group can have zero or more group entries based on the model. If group has no entries, only admin can add entries.
    """
    group_entry = db.query(GroupEntry).get(group_entry_id)
    if group_entry is None:
        raise LookupError("Group entry not found")

    group = get_group(db, user, group_entry.group_id)
    if not user_has_access_to_group(group, user, write_access=True):
        raise GroupPermissionError(
            "User does not have write permissions for this group"
        )

    # Only admin can remove other admins
    settings = config.get_settings()
    print(
        f"user {user} settings.admin_users={settings.admin_users}, {group_entry.email} in {settings.admin_users}"
    )
    if not user in settings.admin_users and group_entry.email in settings.admin_users:
        raise GroupPermissionError("User cannot remove admin")

    owner_entries = [
        group_entry
        for group_entry in group.group_entries
        if group_entry.access_type == AccessType.owner
    ]
    if (len(owner_entries) == 1) and (group_entry.access_type == AccessType.owner):
        raise UserError("Group requires at least one owner!")

    db.query(GroupEntry).filter(GroupEntry.id == group_entry_id).delete()
    db.flush()
    return True
