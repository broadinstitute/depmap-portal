import asyncio

from breadbox.utils.caching import CachingCaller
from aiocache import Cache
from aiocache.serializers import PickleSerializer


def test_caching_caller():
    async def body():
        cc = CachingCaller(Cache.MEMORY(serializer=PickleSerializer()), ttl=100)

        call_count = 0

        def _increment():
            nonlocal call_count
            call_count += 1
            return call_count

        assert await cc.memoize(_increment) == 1
        assert await cc.memoize(_increment) == 1
        assert await cc.memoize(_increment, depends_on=[1]) == 2
        assert await cc.memoize(_increment, depends_on=["a"]) == 3
        assert await cc.memoize(_increment, depends_on=[1]) == 2
        assert await cc.memoize(_increment) == 1

    asyncio.run(body())
