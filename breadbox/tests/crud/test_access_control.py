from breadbox.db.session import SessionWithUser
from breadbox.crud.access_control import (
    PUBLIC_GROUP_ID,
    TRANSIENT_GROUP_ID,
    user_has_access_to_group,
    user_can_view_group_contents,
)
from breadbox.crud.group import (
    add_group,
    add_group_entry,
    get_group,
    delete_group_entry,
)
from breadbox.config import Settings
from breadbox.schemas.group import GroupIn, GroupEntryIn, AccessType


def test_user_has_access_to_group(minimal_db: SessionWithUser, settings: Settings):
    """
    Test that:
    - read-only users don't have write access
    - non-exact group entry matches work as expected
    - everyone has access to the public and transient groups
    """

    admin_user = settings.admin_users[0]
    allowed_writer = "writer@imawriter.org"
    allowed_reads_domain = "@foobar.com"
    read_only_user = "other-person@foobar.com"
    unknown_user1 = "NoAccessHere"
    unknown_user2 = "similar_email@foobar_com"

    # Make the private group
    private_group = add_group(
        minimal_db, admin_user, group_in=GroupIn(name="private_group")
    )
    write_group_entry = GroupEntryIn(
        email=allowed_writer, access_type=AccessType.write, exact_match=True,
    )
    add_group_entry(minimal_db, admin_user, private_group, write_group_entry)
    read_group_entry = GroupEntryIn(
        email=allowed_reads_domain, access_type=AccessType.read, exact_match=False,
    )
    add_group_entry(minimal_db, admin_user, private_group, read_group_entry)

    # Validate write access to private group
    assert user_has_access_to_group(private_group, admin_user, write_access=True)
    assert user_has_access_to_group(private_group, allowed_writer, write_access=True)
    assert not user_has_access_to_group(
        private_group, read_only_user, write_access=True
    )
    assert not user_has_access_to_group(private_group, unknown_user1, write_access=True)
    assert not user_has_access_to_group(private_group, unknown_user2, write_access=True)

    # Validate read access to private group
    assert user_has_access_to_group(private_group, admin_user)
    assert user_has_access_to_group(private_group, allowed_writer)
    assert user_has_access_to_group(private_group, read_only_user)
    assert not user_has_access_to_group(private_group, unknown_user1)
    assert not user_has_access_to_group(private_group, unknown_user2)

    # Check that everyone has access to the Public & Transient groups
    public_group = get_group(minimal_db, admin_user, PUBLIC_GROUP_ID)
    assert user_has_access_to_group(public_group, unknown_user1)
    transient_group = get_group(minimal_db, admin_user, TRANSIENT_GROUP_ID)
    assert user_has_access_to_group(transient_group, unknown_user1)


def test_user_can_view_group_contents(minimal_db: SessionWithUser, settings: Settings):
    """
    Test that:
    - Private datastes are only visible to people in the private group (admins should not have access)
    - Users do not have access to list transient datasets 
    """

    admin_user = settings.admin_users[0]
    private_group_user = "user@IhaveAccess.org"
    unknown_user = "NoAccessHere"

    # Make the private group
    private_group = add_group(
        minimal_db, admin_user, group_in=GroupIn(name="private_group")
    )
    # Find the admin's group entry
    # (they were set sas the owner by default because they created the group)
    admin_group_entry = private_group.group_entries[0]
    owner_group_entry = GroupEntryIn(
        email=private_group_user, access_type=AccessType.owner, exact_match=True,
    )
    add_group_entry(minimal_db, admin_user, private_group, owner_group_entry)

    # Remove the admin from the private group
    delete_group_entry(minimal_db, admin_user, group_entry_id=admin_group_entry.id)

    # Commit changes to refresh the group object
    minimal_db.commit()

    # Validate that private datastes are only visible to people in the private group
    # even though the group itself may be visible to admins
    assert not user_can_view_group_contents(private_group, admin_user)
    assert user_can_view_group_contents(private_group, private_group_user)
    assert not user_can_view_group_contents(private_group, unknown_user)

    # Validate that users don't have access to list transient datasets
    transient_group = get_group(minimal_db, admin_user, TRANSIENT_GROUP_ID)
    assert not user_can_view_group_contents(transient_group, admin_user)
    assert not user_can_view_group_contents(transient_group, private_group_user)
    assert not user_can_view_group_contents(transient_group, unknown_user)

    # Validate that everyone has permission to list public datasets
    public_group = get_group(minimal_db, admin_user, PUBLIC_GROUP_ID)
    assert user_can_view_group_contents(public_group, admin_user)
    assert user_can_view_group_contents(public_group, private_group_user)
    assert user_can_view_group_contents(public_group, unknown_user)
