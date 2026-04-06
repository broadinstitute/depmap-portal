from typing import List, Optional, Union

from sqlalchemy.orm import Session

from breadbox.models.cms import CmsMenu, CmsMenuPost, CmsPost
from breadbox.schemas.cms import MenuIn, MenuOut, PostIn, PostOut, PostSummaryOut
from breadbox.schemas.custom_http_exception import ResourceNotFoundError


def _build_menu_out(menu: CmsMenu) -> MenuOut:
    posts = [link.post.slug for link in menu.post_links]
    child_menus = [_build_menu_out(child) for child in menu.children]
    return MenuOut(
        slug=menu.slug, title=menu.title, child_menus=child_menus, posts=posts
    )


def get_menu(db: Session) -> List[MenuOut]:
    roots = (
        db.query(CmsMenu)
        .filter(CmsMenu.parent_id == None)
        .order_by(CmsMenu.order_index)
        .all()
    )
    return [_build_menu_out(root) for root in roots]


def _insert_menu_nodes(
    db: Session, items: List[MenuIn], parent_id: Optional[str], post_slug_to_id: dict,
) -> None:
    for order_index, item in enumerate(items):
        node = CmsMenu(
            slug=item.slug,
            title=item.title,
            parent_id=parent_id,
            order_index=order_index,
        )
        db.add(node)
        db.flush()  # get node.id

        for post_order, slug in enumerate(item.posts):
            post_id = post_slug_to_id.get(slug)
            if post_id is not None:
                link = CmsMenuPost(
                    menu_id=node.id, post_id=post_id, order_index=post_order
                )
                db.add(link)

        _insert_menu_nodes(db, item.child_menus, node.id, post_slug_to_id)


def set_menu(db: Session, menu_data: List[MenuIn]) -> List[MenuOut]:
    # Delete all existing menu rows (cascade handles children and post_links)
    db.query(CmsMenu).filter(CmsMenu.parent_id == None).delete(
        synchronize_session=False
    )

    # Build slug→id map for posts
    posts = db.query(CmsPost).all()
    post_slug_to_id = {p.slug: p.id for p in posts}

    _insert_menu_nodes(db, menu_data, None, post_slug_to_id)
    db.flush()

    return get_menu(db)


def get_posts(
    db: Session, include_content: bool
) -> List[Union[PostOut, PostSummaryOut]]:
    posts = db.query(CmsPost).all()
    if include_content:
        return [PostOut.model_validate(p) for p in posts]
    else:
        return [PostSummaryOut.model_validate(p) for p in posts]


def get_post(db: Session, post_id: str) -> PostOut:
    post = db.query(CmsPost).filter(CmsPost.id == post_id).first()
    if post is None:
        raise ResourceNotFoundError(f"Post '{post_id}' not found")
    return PostOut.model_validate(post)


def upsert_post(db: Session, post_id: str, data: PostIn) -> PostOut:
    post = db.query(CmsPost).filter(CmsPost.id == post_id).first()
    if post is None:
        post = CmsPost(
            id=post_id,
            slug=data.slug,
            title=data.title,
            content=data.content,
            content_hash=data.content_hash,
        )
        db.add(post)
    else:
        post.slug = data.slug
        post.title = data.title
        post.content = data.content
        post.content_hash = data.content_hash

    db.flush()
    db.refresh(post)
    return PostOut.model_validate(post)


def delete_post(db: Session, post_id: str) -> None:
    post = db.query(CmsPost).filter(CmsPost.id == post_id).first()
    if post is None:
        raise ResourceNotFoundError(f"Post '{post_id}' not found")
    db.delete(post)
    db.flush()
