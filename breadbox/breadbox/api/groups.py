from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from breadbox.db.session import SessionWithUser
from breadbox.config import Settings, get_settings
from breadbox.crud.access_control import user_can_view_group_contents
from breadbox.crud import group as group_crud
from breadbox.models.group import Group
from breadbox.schemas.group import GroupEntryIn, GroupIn, GroupEntry
from breadbox.schemas.groupout import GroupOut
from breadbox.api.dependencies import get_db_with_user, get_user
from ..db.util import transaction

router = APIRouter(prefix="/groups", tags=["groups"],)


@router.get(
    "/",
    operation_id="get_groups",
    response_model=List[GroupOut],
    response_model_exclude_none=False,
)
def get_groups(
    write_access: Optional[bool] = None,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Get groups that the user has access to.

    If `write_access` is True (truthy), then only return groups that the user has write
    access to.
    """
    if write_access is None:
        write_access = False

    visible_groups = group_crud.get_visible_groups(db, user, write_access)

    response = []
    for group in visible_groups:
        response.append(_get_access_controlled_group_response(group, user))
    return response


@router.get(
    "/{group_id}",
    operation_id="get_group",
    response_model=GroupOut,
    response_model_exclude_none=False,
)
def get_group(
    group_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Get a group by group id. Returns the group if user has access or is part of the group.
    """
    group = group_crud.get_group(db, user, group_id, write_access=True)

    if not group:
        group = group_crud.get_group(db, user, group_id, write_access=False)
        # If user is not part of group, they will not get the group returned
        if group is None:
            raise HTTPException(404, "Group not found")

    return _get_access_controlled_group_response(group, user)


def _get_access_controlled_group_response(group: Group, user: str) -> GroupOut:
    group_has_visible_contents = user_can_view_group_contents(group, user)
    return GroupOut(
        id=group.id,
        name=group.name,
        group_entries=group.group_entries,
        datasets=group.datasets if group_has_visible_contents else None,
    )


@router.post(
    "/",
    operation_id="add_group",
    response_model=GroupOut,
    response_model_exclude_none=False,
)
def add_group(
    group: GroupIn,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
    settings: Settings = Depends(get_settings),
):
    """
    Create an access control group.

    Only available to admin users.

    Automatically adds the user creating the group to the list of users with write
    permissions for the group.
    """
    if user not in settings.admin_users:
        raise HTTPException(403)

    with transaction(db):
        group_db = group_crud.add_group(db, user, group)

    return group_db


@router.delete(
    "/{group_id}", operation_id="remove_group",
)
def delete_group(
    group_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Deletes group that the user has write access to.

    WARNING: Also deletes group entries in the group. Cannot delete group if there are datasets in group.
    """

    group = group_crud.get_group(db, user, group_id, write_access=True)

    if group is None:
        if group_crud.get_group(db, user, group_id, write_access=False) is None:
            raise HTTPException(404, "Group not found")
        raise HTTPException(403, "You do not have permission to delete this group")

    with transaction(db):
        group_deleted = group_crud.delete_group(db, user, group)

    if group_deleted:
        return {"message": "Deleted group"}


@router.post(
    "/{group_id}/addAccess", operation_id="add_group_entry", response_model=GroupEntry
)
def add_group_entry(
    group_id: str,
    group_entry: GroupEntryIn,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Give a user or group of users (by email suffix) read or write permissions for a
    group.
    """
    with transaction(db):
        group = group_crud.get_group(db, user, group_id, write_access=True)

        if group is None:
            if group_crud.get_group(db, user, group_id, write_access=False) is None:
                raise HTTPException(404)
            raise HTTPException(403)

        group_entry_db = group_crud.add_group_entry(db, user, group, group_entry)
    return group_entry_db


@router.delete(
    "/{group_entry_id}/removeAccess", operation_id="remove_group_access",
)
def delete_group_entry(
    group_entry_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    """
    Remove group entry by a given group entry id. Only users with write access can delete entries
    """
    with transaction(db):
        try:
            group_entry_delete = group_crud.delete_group_entry(db, user, group_entry_id)
            return {"message": "Deleted group entry"}
        except LookupError as e:
            raise HTTPException(404, str(e))
