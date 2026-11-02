"""
Cache invalidation for etags.

Some endpoints (see `render_if_changed` in breadbox/api/utils.py) skip rendering a response when the
client already has an up-to-date copy. To know whether a copy is up to date, every cacheable query
result has a named **cache key**, and each key has a stored **version** (the `cache_version` table).

- Reads declare which cache keys their result depends on. The etag is a hash of those keys' versions.
- Writes *invalidate* the cache keys they could affect by replacing the version with a fresh random
  value, in the same transaction as the write itself.

If you add or change a write path (crud or service) which can change what one of these queries
returns, you must invalidate the matching key. Over-invalidating is safe (just a cache miss);
under-invalidating serves stale data.

Key                      Read by                                      Invalidate when
-----------------------  -------------------------------------------  ------------------------------------------
GET_DATASETS             GET /datasets/ (any group other than public)  a non-transient dataset is added, changed
                         and dimension type identifiers                or deleted; groups or group entries change
                                                                       (they control visibility); a dimension type
                                                                       is added or deleted
GET_DATASETS_PUBLIC      GET /datasets/?group_id=<public>             a non-transient dataset in the public group
                                                                       is added, changed, deleted or moved in/out
DIMENSION_TYPES          dimension type identifiers                   a dimension type or its metadata changes

Transient datasets never appear in these queries, so changes to them invalidate nothing.
"""
import uuid
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert

from breadbox.crud.access_control import PUBLIC_GROUP_ID
from breadbox.db.session import SessionWithUser
from breadbox.models.cache_version import CacheVersion
from breadbox.models.dataset import Dataset

GET_DATASETS = "get_datasets()"
GET_DATASETS_PUBLIC = "get_datasets(PUBLIC)"
DIMENSION_TYPES = "dimension_types"

ALL_CACHE_KEYS = [GET_DATASETS, GET_DATASETS_PUBLIC, DIMENSION_TYPES]


def invalidate_cache_keys(db: SessionWithUser, *keys: str) -> None:
    """
    Marks everything cached under the given keys as stale. Does not commit, so the invalidation
    becomes visible atomically with the write that caused it.

    Like get_cache_versions this exposes no data, so it does not take a user.
    """
    for key in keys:
        statement = insert(CacheVersion).values(key=key, version=uuid.uuid4().hex)
        db.execute(
            statement.on_conflict_do_update(
                index_elements=[CacheVersion.key],
                set_={"version": statement.excluded.version},
            )
        )


def get_cache_versions(db: SessionWithUser, keys: List[str]) -> Dict[str, str]:
    """
    Returns the current version of each of the given cache keys. If a version differs from one
    fetched earlier, the result cached under that key is stale. A key which has never been
    invalidated has the version "".
    """
    rows = db.execute(
        select(CacheVersion.key, CacheVersion.version).where(CacheVersion.key.in_(keys))
    ).all()
    versions = {key: version for key, version in rows}
    return {key: versions.get(key, "") for key in keys}


def invalidate_for_dataset_change(
    db: SessionWithUser, dataset: Dataset, *, old_group_id: Optional[str] = None
) -> None:
    """
    Call after a dataset is added, changed or deleted. Pass `old_group_id` if the dataset's group
    changed, so that the group it left is invalidated as well.

    A dataset that is transient (or was and still is) does not appear in any cached query, so
    nothing is invalidated for it. Callers that flip a dataset from transient to non-transient
    should call this after the flip.
    """
    if dataset.is_transient:
        return

    keys = [GET_DATASETS]
    if PUBLIC_GROUP_ID in (dataset.group_id, old_group_id):
        keys.append(GET_DATASETS_PUBLIC)
    invalidate_cache_keys(db, *keys)
