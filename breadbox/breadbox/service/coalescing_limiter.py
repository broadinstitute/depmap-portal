"""
A bounded-capacity async executor that knows nothing about what it runs: it caps how many
computations run at once (with a short wait queue), shares one run between identical
concurrent requests (single-flight), and optionally caches finished results.
"""
import asyncio
import collections
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Deque, Dict, Optional, Tuple

from cachetools import TTLCache


class Busy(Exception):
    """The concurrency cap is reached and the wait queue is full (or the wait ran out)."""


@dataclass
class Timing:
    queue_ms: float = 0.0
    node_ms: float = 0.0  # set by the computation itself


@dataclass
class _Flight:
    task: "asyncio.Future[bytes]"
    timing: Timing
    waiters: int = 0


class CoalescingLimiter:
    def __init__(
        self,
        *,
        max_concurrency: int,
        max_queue: int,
        queue_timeout_seconds: float,
        cache: Optional["TTLCache[str, bytes]"] = None,
    ):
        self.cache = cache
        self._max_concurrency = max_concurrency
        self._max_queue = max_queue
        self._queue_timeout = queue_timeout_seconds
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._flights: Dict[str, _Flight] = {}
        self._active = 0
        self._waiters: Deque["asyncio.Future[None]"] = collections.deque()

    async def run(
        self,
        key: str,
        compute: Callable[[Timing], Awaitable[bytes]],
        observe: Optional[Callable[[str, Timing], None]] = None,
    ) -> Tuple[bytes, str, Timing]:
        """
        Returns (value, "hit" | "miss" | "coalesced", timing). `compute` receives the Timing
        to fill in. `observe` is told the cache state and timing as soon as they are known,
        so a caller can still report them if this raises or is cancelled.

        A cancelled caller never cancels the run for the others; the last one to leave
        cancels it (which is how the child process gets killed).
        """
        self._bind_loop()
        if self.cache is not None:
            hit = self.cache.get(key)
            if hit is not None:
                timing = Timing()
                if observe:
                    observe("hit", timing)
                return hit, "hit", timing

        flight = self._flights.get(key)
        state = "coalesced"
        if flight is None:
            flight = self._start_flight(key, compute)
            state = "miss"
        if observe:
            observe(state, flight.timing)
        value = await self._wait_for_flight(flight)
        return value, state, flight.timing

    def _bind_loop(self) -> None:
        loop = asyncio.get_running_loop()
        if self._loop is not loop:
            # Futures and waiters belong to a loop. In production there is only one; this
            # only matters for test clients that make a new loop per request.
            self._loop = loop
            self._flights = {}
            self._active = 0
            self._waiters = collections.deque()

    def _start_flight(
        self, key: str, compute: Callable[[Timing], Awaitable[bytes]]
    ) -> _Flight:
        timing = Timing()
        task = asyncio.ensure_future(self._execute(key, compute, timing))
        flight = _Flight(task=task, timing=timing)
        self._flights[key] = flight

        def done(t: "asyncio.Future[bytes]") -> None:
            if self._flights.get(key) is flight:
                del self._flights[key]
            if not t.cancelled():
                t.exception()  # mark retrieved; waiters re-raise it themselves

        task.add_done_callback(done)
        return flight

    async def _wait_for_flight(self, flight: _Flight) -> bytes:
        flight.waiters += 1
        try:
            # shield: cancelling one waiter must not cancel the run for the others
            return await asyncio.shield(flight.task)
        except asyncio.CancelledError:
            if flight.waiters == 1:
                # the last one out turns off the lights
                flight.task.cancel()
            raise
        finally:
            flight.waiters -= 1

    async def _execute(
        self, key: str, compute: Callable[[Timing], Awaitable[bytes]], timing: Timing,
    ) -> bytes:
        queued_at = time.monotonic()
        await self._acquire_slot()
        try:
            timing.queue_ms = (time.monotonic() - queued_at) * 1000
            value = await compute(timing)
        finally:
            self._release_slot()
        # (errors are never cached: they raised above)
        if self.cache is not None and len(value) <= self.cache.maxsize:
            self.cache[key] = value
        return value

    # ------------------------------------------- concurrency cap and wait queue

    async def _acquire_slot(self) -> None:
        if self._active < self._max_concurrency:
            self._active += 1
            return
        if len(self._waiters) >= self._max_queue:
            raise Busy()
        fut: "asyncio.Future[None]" = asyncio.get_running_loop().create_future()
        self._waiters.append(fut)
        try:
            done, _ = await asyncio.wait({fut}, timeout=self._queue_timeout)
        except asyncio.CancelledError:
            self._abandon(fut)
            raise
        if not done:
            self._abandon(fut)
            raise Busy()

    def _abandon(self, fut: "asyncio.Future[None]") -> None:
        if fut.done() and not fut.cancelled():
            # a slot had already been handed to us; pass it on
            self._release_slot()
            return
        fut.cancel()
        try:
            self._waiters.remove(fut)
        except ValueError:
            pass

    def _release_slot(self) -> None:
        while self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():
                # the slot moves to the waiter; _active is unchanged
                waiter.set_result(None)
                return
        self._active -= 1
