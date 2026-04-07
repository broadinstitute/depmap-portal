from typing import List, Optional
from sqlalchemy import String, Integer, Boolean, Date, ForeignKey, UniqueConstraint
from datetime import date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from breadbox.db.base_class import Base, UUIDMixin


class ReleaseVersion(Base, UUIDMixin):
    __tablename__ = "release_version"
    __table_args__ = (UniqueConstraint("version_name", "release_name"),)

    version_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    version_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # 32-char MD5
    content_hash: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # Metadata and Citations
    release_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    citation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    funding: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    terms: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    files: Mapped[List["ReleaseFile"]] = relationship(
        "ReleaseFile", back_populates="release_version", cascade="all, delete-orphan"
    )

    release_pipelines: Mapped[List["ReleasePipeline"]] = relationship(
        "ReleasePipeline",
        back_populates="release_version",
        cascade="all, delete-orphan",
    )


class ReleasePipeline(Base, UUIDMixin):
    __tablename__ = "release_pipeline"

    release_version_id: Mapped[str] = mapped_column(
        String, ForeignKey("release_version.id", ondelete="CASCADE"), nullable=False
    )
    pipeline_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    release_version: Mapped["ReleaseVersion"] = relationship(
        "ReleaseVersion", back_populates="release_pipelines"
    )


class ReleaseFile(Base, UUIDMixin):
    __tablename__ = "release_file"

    release_version_id: Mapped[str] = mapped_column(
        String, ForeignKey("release_version.id", ondelete="CASCADE"), nullable=False
    )

    # File Metadata
    file_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    datatype: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # e.g., "1.2GB"
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # gs path. empty means retracted
    bucket_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    taiga_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    canonical_taiga_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    md5_hash: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)
    pipeline_name: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, default=None
    )
    is_main_file: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    release_version: Mapped["ReleaseVersion"] = relationship(
        "ReleaseVersion", back_populates="files"
    )


class ReleaseFileSearchIndex(Base):
    """
    FTS5 Virtual Table - File Level Indexing.
    Each row in this table represents one ReleaseFile.
    """

    __tablename__ = "release_file_search_index"
    __table_args__ = {"info": {"skip_autogenerate": True}}

    # rowid MUST be an int for FTS5
    rowid: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Store the actual File UUID here instead of directly on rowid
    file_id: Mapped[str] = mapped_column(String)

    # File-specific metadata
    file_name: Mapped[str] = mapped_column(String)
    file_description: Mapped[str] = mapped_column(String)
    file_datatype: Mapped[str] = mapped_column(String)
    release_version_name: Mapped[str] = mapped_column(String)
    release_name: Mapped[str] = mapped_column(String)
    release_version_description: Mapped[str] = mapped_column(String)
    release_version_content_hash: Mapped[str] = mapped_column(String(32))
