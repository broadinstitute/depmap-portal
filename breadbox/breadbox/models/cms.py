import uuid
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from breadbox.db.base_class import Base


class CmsPost(Base):
    __tablename__ = "cms_post"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class CmsMenu(Base):
    __tablename__ = "cms_menu"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    slug: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("cms_menu.id", ondelete="CASCADE"), nullable=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    children: Mapped[List["CmsMenu"]] = relationship(
        "CmsMenu",
        back_populates="parent",
        order_by="CmsMenu.order_index",
        cascade="all, delete-orphan",
    )
    parent: Mapped[Optional["CmsMenu"]] = relationship(
        "CmsMenu", back_populates="children", remote_side=[id]
    )
    post_links: Mapped[List["CmsMenuPost"]] = relationship(
        "CmsMenuPost", order_by="CmsMenuPost.order_index", cascade="all, delete-orphan",
    )


class CmsMenuPost(Base):
    __tablename__ = "cms_menu_post"

    menu_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cms_menu.id", ondelete="CASCADE"), primary_key=True,
    )
    post_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cms_post.id", ondelete="CASCADE"), primary_key=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    post: Mapped["CmsPost"] = relationship("CmsPost")
