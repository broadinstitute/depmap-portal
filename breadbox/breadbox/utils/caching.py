from typing import Optional
from aiocache import Cache, BaseCache
from aiocache.serializers import PickleSerializer
import json
import hashlib
from aiocache.backends.redis import RedisCache


class CachingCaller:
    def __init__(self, cache: Optional[BaseCache], ttl: int):
        # if cache is None, then it will do all steps except trying to get/fetch
        # value from cache. This is to make sure the rest of the code path works when tests are run
        self.cache = cache
        self.ttl = ttl

    async def memoize(self, function, *, depends_on=None, ttl=None):
        """
        Memoize a function by caching the value.

        This tries to follow the pattern that react uses. Pass a function which takes no arguments and a list of values which when changed, will result in the function being recomputed.
        Note: depends_on must be serializable by json.dumps() so stick with simple types (list, dict, str, int, etc)
        """

        cache_key = json.dumps(depends_on, sort_keys=True)
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
