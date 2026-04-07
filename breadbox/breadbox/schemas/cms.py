from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class PostIn(BaseModel):
    slug: str
    title: str
    content: str
    content_hash: str
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class PostOut(BaseModel):
    id: str
    slug: str
    title: str
    content: str
    content_hash: str
    updated_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PostSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    content_hash: str
    updated_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class Menu(BaseModel):
    slug: str
    title: str
    child_menus: List["Menu"] = []
    posts: List[str] = []  # list of post slugs

    class Config:
        from_attributes = True


Menu.model_rebuild()
