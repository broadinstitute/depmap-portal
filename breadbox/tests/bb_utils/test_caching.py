import asyncio

from breadbox.db.session import SessionWithUser
from breadbox.utils.caching import CachingCaller
from aiocache import Cache
from aiocache.serializers import PickleSerializer


def test_memoize_db_query(minimal_db: SessionWithUser):
    async def body():
        cc = CachingCaller(Cache.MEMORY(serializer=PickleSerializer()), ttl=100)

        def _record_user(db: SessionWithUser):
            return "user:" + db.user

        # if we can cache, make sure _record_user was called with anonymous user
        result = await cc.memoize_db_query(minimal_db, lambda: True, _record_user)
        assert result == "user:anonymous"
        # if we can't can cache, it's fine for any user
        result = await cc.memoize_db_query(minimal_db, lambda: False, _record_user)
        assert result != "user:anonymous"

    asyncio.run(body())


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
