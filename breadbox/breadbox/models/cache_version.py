from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from breadbox.db.base_class import Base


class CacheVersion(Base):
    """
    One row per named cache key (see breadbox/crud/cache_invalidation.py). `version` is replaced with a
    fresh random value whenever something happens which could change the result cached under that key,
    so a changed version means the cached result is stale.
    """

    __tablename__ = "cache_version"

    key: Mapped[str] = mapped_column(String, nullable=False, primary_key=True)
    version: Mapped[str] = mapped_column(String, nullable=False)
