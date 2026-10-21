import asyncio

import pytest
from cachetools import TTLCache

from breadbox.service.coalescing_limiter import Busy, CoalescingLimiter


def make(cache=None):
    return CoalescingLimiter(
        max_concurrency=1, max_queue=1, queue_timeout_seconds=1.0, cache=cache
    )


def test_identical_keys_share_one_run_and_results_are_cached():
    limiter = make(cache=TTLCache(maxsize=100, ttl=60, getsizeof=len))
    runs = []

    async def main():
        gate = asyncio.Event()

        async def compute(timing):
            runs.append(1)
            await gate.wait()
            return b"v"

        t1 = asyncio.ensure_future(limiter.run("k", compute))
        t2 = asyncio.ensure_future(limiter.run("k", compute))
        await asyncio.sleep(0.05)
        gate.set()
        r1, r2 = await t1, await t2
        r3 = await limiter.run("k", compute)
        return r1, r2, r3

    r1, r2, r3 = asyncio.run(main())
    assert sorted([r1[1], r2[1]]) == ["coalesced", "miss"]
    assert r3[1] == "hit" and r3[0] == b"v"
    assert len(runs) == 1


def test_full_queue_raises_busy_and_slots_are_returned():
    limiter = make()

    async def main():
        gate = asyncio.Event()

        async def slow(timing):
            await gate.wait()
            return b"x"

        async def fast(timing):
            return b"y"

        running = asyncio.ensure_future(limiter.run("a", slow))
        await asyncio.sleep(0.02)
        queued = asyncio.ensure_future(limiter.run("b", fast))
        await asyncio.sleep(0.02)
        with pytest.raises(Busy):
            await limiter.run("c", fast)
        gate.set()
        await running
        assert (await queued)[0] == b"y"

    asyncio.run(main())
    assert limiter._active == 0 and not limiter._waiters


def test_errors_are_not_cached_and_last_waiter_cancels_the_run():
    limiter = make(cache=TTLCache(maxsize=100, ttl=60, getsizeof=len))
    state = {"cancelled": False, "calls": 0}

    async def boom(timing):
        state["calls"] += 1
        raise ValueError("nope")

    async def forever(timing):
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            state["cancelled"] = True
            raise
        return b""

    async def main():
        for _ in range(2):
            with pytest.raises(ValueError):
                await limiter.run("e", boom)
        task = asyncio.ensure_future(limiter.run("f", forever))
        await asyncio.sleep(0.02)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await asyncio.sleep(0.02)

    asyncio.run(main())
    assert state == {"cancelled": True, "calls": 2}
    assert limiter._active == 0 and not limiter._flights
