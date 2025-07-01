from uuid import UUID

from sqlalchemy.orm import Session

from breadbox.models.group import AccessType, Group
from breadbox import config

PUBLIC_GROUP_ID = str(UUID("00000000-0000-0000-0000-000000000000"))
TRANSIENT_GROUP_ID = str(UUID("11111111-1111-1111-1111-111111111111"))


def user_has_access_to_group(
    group: Group, user: str, write_access: bool = False
) -> bool:
    """
    Checks if user has access to group. User has access if they are in the group's group entries.
    Admin has access to all groups whether or not they are in the group's group entries.
    """
    # Admin has access to all groups.
    assert user is not None

    settings = config.get_settings()
    if user in settings.admin_users:
        return True

    # adding a special case for special groups, to avoid running into the assertion below
    # that all email entries must start with a "@" if group_entry.exact_match == False
    # We should clean up that entry because I think it'd be better if it doesn't exist -- but for now, let's avoid the data migration.
    # This means that only the public group which is possible to be viewable by _all_ users. Similarly all users need to be
    # able to access the transient group.
    if group.id in [PUBLIC_GROUP_ID, TRANSIENT_GROUP_ID] and write_access is False:
        return True

    # Check if user is in group's group entries
    if write_access:
        group_entries = [
            group_entry
            for group_entry in group.group_entries
            if (
                (group_entry.access_type == AccessType.write)
                or (group_entry.access_type == AccessType.owner)
            )
        ]
    else:
        group_entries = group.group_entries

    for group_entry in group_entries:
        if group_entry.exact_match:
            if group_entry.email == user:
                return True
        else:
            # I'm adding this check because I'm concerned that it is too easy to accidentally add a group entry which isn't specific enough.
            # For example, if `group_entry.email == ""` then all users would match that. Or similarly, if someone
            # added an entry with `group_entry.email == "apple.com"` then the email address `fake@not-apple.com` would
            # also return true. To avoid these potential problems require that the suffix always starts with "@".
            # This is checked when adding an entry, but assert that's the case just as a last sanity test
            assert group_entry.email.startswith(
                "@"
            ), f"If group_entry.exact_match is False, we require the email address field contain the full domain name, starting with @ but the value was {repr(group_entry.email)}"
            if user.endswith(group_entry.email):
                return True

    return False


def user_can_view_group_contents(group: Group, user: str) -> bool:
    """
    Checks whether a user can view the datasets and other contents of a group.
    This is used for situations where we don't want data to be discoverable by users. 
    For example,
    - No users can view the list of all transient datasets, but anyone can read a transient dataset that they know the ID of.
    - Admins can view/edit access controls for private groups but can't view datasets belonging to private groups they're not a part of. 
    """
    assert user is not None

    if group.id == TRANSIENT_GROUP_ID:
        return False

    for group_entry in group.group_entries:
        if group_entry.exact_match and group_entry.email == user:
            return True
        elif not group_entry.exact_match and user.endswith(group_entry.email):
            return True
    return False


def get_read_access_group_ids(
    db: Session, user: str, write_access: bool = False,
) -> list[str]:
    """
    Get all groups that the user can read data from (used for global access controls).
    Note: Users may read from the transient group when they know the dataset ID.
    """
    all_groups = db.query(Group).all()

    return [
        group.id
        for group in all_groups
        if user_has_access_to_group(group, user, write_access)
    ]
