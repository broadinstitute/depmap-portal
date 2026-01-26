from typing import Optional, Callable, Any
from aiocache import Cache, BaseCache
from aiocache.serializers import PickleSerializer
import json
import hashlib
from aiocache.backends.redis import RedisCache

from breadbox.db.session import SessionWithUser


def _make_cache_key(object: Any):
    return json.dumps(object, sort_keys=True)


class CachingCaller:
    def __init__(self, cache: Optional[BaseCache], ttl: int):
        # if cache is None, then it will do all steps except trying to get/fetch
        # value from cache. This is to make sure the rest of the code path works when tests are run
        self.cache = cache
        self.ttl = ttl

    async def memoize_db_query(
        self,
        db: SessionWithUser,
        safe_to_cache: Callable[[], bool],
        function: Callable[[SessionWithUser], Any],
        *,
        depends_on=None,
        ttl=None
    ):
        """
        Used when we want to memoize a function which fetches data from the database. When `function`
        is called to retrieve data, it's passed a db session which only has access to public data
        to avoid the risk of one user seeing another user's data.

        safe_to_cache is provided as a parameter so that we can provide a function to decide if the data
        is public or not. In this way, we avoid the caller having two have two code paths (and needing
        test coverage for both).
        """

        # Technically unnecessary, but see comment on `memoize` for explanation why cache_key computed here
        cache_key = _make_cache_key(depends_on)

        if safe_to_cache():
            anon_db = db.create_session_for_anonymous_user()
            return await self.memoize(
                lambda: function(anon_db), cache_key=cache_key, ttl=ttl
            )
        else:
            return function(db)

    async def memoize(
        self,
        function: Callable[[], Any],
        *,
        depends_on=None,
        ttl=None,
        cache_key: Optional[str] = None
    ):
        """
        Memoize a function by caching the value.

        This tries to follow the pattern that react uses. Pass a function which takes no arguments and a list of values which when changed, will result in the function being recomputed.
        Note: depends_on must be serializable by json.dumps() so stick with simple types (list, dict, str, int, etc)

        Normally `depends_on` should be provided, and cache_key left out. However, I've added cache_key so that
        it can be computed inside of `memoize_db_query`. This is largely to force it to be computed in both the case
        where caching is needed, and cases where it's not. This is technically unnecessary, but it increases the
        test coverage when unit tests run and I worry about a non-json-serializeable value being passed in depends_on
        and not catching that in a test.
        """

        if cache_key is None:
            cache_key = _make_cache_key(depends_on)
        else:
            assert depends_on is None

        # I worry that there's a length limit on keys, but `depends_on` could result in an arbitrarily long
        # string. So, use sha256 to get a hash that's a reasonable size
        cache_key = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()
        if ttl is None:
            ttl = self.ttl

        value = None
        if self.cache is not None:
            value = await self.cache.get(cache_key)

        if value is None:
            value = function()

            if self.cache is not None:
                await self.cache.set(cache_key, value, ttl=ttl)

        return value


def create_caching_caller(redis_host: Optional[str]):
    if redis_host is None:
        cache = None
    else:
        endpoint, port = redis_host.split(":")
        cache = RedisCache(
            endpoint=endpoint,  # pyright: ignore
            port=int(port),
            namespace="breadbox-cache",
            serializer=PickleSerializer(),
        )

    return CachingCaller(
        cache, ttl=60 * 60
    )  # cache for 60 minutes. Set completely arbitrarily -- but would like keys to eventually expire
