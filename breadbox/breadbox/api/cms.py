from typing import List, Union

from fastapi import APIRouter, Depends

from breadbox.api.dependencies import get_admin_user, get_db_with_user, get_user
from breadbox.crud import cms as cms_crud
from breadbox.db.session import SessionWithUser
from breadbox.schemas.cms import MenuIn, MenuOut, PostIn, PostOut, PostSummaryOut
from breadbox.db.util import transaction

router = APIRouter(prefix="/cms", tags=["cms"])


@router.get("/menu", operation_id="get_cms_menu", response_model=List[MenuOut])
def get_menu(
    db: SessionWithUser = Depends(get_db_with_user), user: str = Depends(get_user),
):
    return cms_crud.get_menu(db)


@router.post("/menu", operation_id="set_cms_menu", response_model=List[MenuOut])
def set_menu(
    body: List[MenuIn],
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_admin_user),
):
    with transaction(db):
        return cms_crud.set_menu(db, body)


@router.get(
    "/posts",
    operation_id="get_cms_posts",
    response_model=List[Union[PostOut, PostSummaryOut]],
)
def get_posts(
    include_content: bool = False,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    return cms_crud.get_posts(db, include_content)


@router.get("/posts/{post_id}", operation_id="get_cms_post", response_model=PostOut)
def get_post(
    post_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_user),
):
    return cms_crud.get_post(db, post_id)


@router.post("/posts/{post_id}", operation_id="upsert_cms_post", response_model=PostOut)
def upsert_post(
    post_id: str,
    body: PostIn,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_admin_user),
):
    with transaction(db):
        return cms_crud.upsert_post(db, post_id, body)


@router.delete("/posts/{post_id}", operation_id="delete_cms_post", status_code=204)
def delete_post(
    post_id: str,
    db: SessionWithUser = Depends(get_db_with_user),
    user: str = Depends(get_admin_user),
):
    with transaction(db):
        cms_crud.delete_post(db, post_id)
