from unittest.mock import MagicMock

from breadbox.service.tempspace import DoesNotExist, FileObjStore, Tempspace


class FakeClock:
    """A settable clock so tests can move time across interval boundaries deterministically."""

    # start well past interval 0 so that "previous interval" fallback lookups
    # (interval_index - 1) never go negative, matching real wall-clock usage

    def __init__(self, t: float = 10000):
        self.t = t

    def advance(self, dt: float):
        self.t += dt

    def __call__(self):
        return self.t


class RaceyFileObjStore(FileObjStore):
    """Simulates another process deleting the file out from under us between the
    `exists()` check in `get_path_if_exists` and the subsequent `copy()` call."""

    def copy(self, src_path: str, dst_path: str):
        raise DoesNotExist(src_path)


def _write_local_file(tmpdir, contents: str) -> str:
    src = tmpdir.join("source.txt")
    src.write(contents)
    return str(src)


# ============================================================================
# Scenario: an actively-accessed file survives indefinitely by being carried
# forward into each new interval, and its content always round-trips.
# ============================================================================
def test_read_your_writes_and_carry_forward_across_intervals(tmpdir):
    storage = FileObjStore(str(tmpdir.mkdir("storage")))
    clock = FakeClock()
    ts = Tempspace(storage, interval=10, clock=clock, max_delete_count=50)

    # per the get_path_if_exists/put contract: get_path_if_exists computes the
    # interval-bucketed path, and the caller creates it there via put() if missing
    src = _write_local_file(tmpdir, "hello world")
    path, found = ts.get_path_if_exists("myfile")
    assert not found
    ts.put(src, path)

    # found within the same interval
    path, found = ts.get_path_if_exists("myfile")
    assert found
    dest = str(tmpdir.join("out1.txt"))
    ts.get(path, dest)
    assert open(dest).read() == "hello world"

    # advance into the next interval: found via the "previous interval" fallback,
    # and copied forward to the new current-interval path
    clock.advance(10)
    path2, found = ts.get_path_if_exists("myfile")
    assert found
    assert path2 != path
    dest2 = str(tmpdir.join("out2.txt"))
    ts.get(path2, dest2)
    assert open(dest2).read() == "hello world"

    # advance into yet another interval: still found and still correct
    clock.advance(10)
    path3, found = ts.get_path_if_exists("myfile")
    assert found
    assert path3 != path2
    dest3 = str(tmpdir.join("out3.txt"))
    ts.get(path3, dest3)
    assert open(dest3).read() == "hello world"


# ============================================================================
# Scenario: gc() reclaims old generations, bounded by max_delete_count per call,
# and never touches the current or previous generation (the two live semispaces).
# ============================================================================
def test_gc_reclaims_old_generations_within_max_delete_count_budget(tmpdir):
    storage = FileObjStore(str(tmpdir.mkdir("storage")))
    clock = FakeClock(t=1000)
    ts = Tempspace(storage, interval=10, clock=clock, max_delete_count=2)
    current_index = ts._get_current_interval_index()

    # seed 5 files of "garbage" directly into old generations, bypassing put().
    # gc() reclaims everything strictly older than the "previous" generation
    # (current_index - 1), so generations current_index-6 .. current_index-2
    # should all be eligible for collection.
    old_paths = []
    for offset in range(2, 7):
        gen = current_index - offset
        path = ts._make_path(gen, f"garbage{gen}")
        src = _write_local_file(tmpdir, f"garbage{gen}")
        storage.put(src, path)
        old_paths.append(path)

    # seed a file in the "previous" generation that must survive gc()
    previous_gen_path = ts._make_path(current_index - 1, "keepme")
    storage.put(_write_local_file(tmpdir, "keepme"), previous_gen_path)

    # each gc() call deletes no more than max_delete_count files
    ts.gc()
    remaining = [p for p in old_paths if storage.exists(p)]
    assert len(remaining) == 3

    ts.gc()
    remaining = [p for p in old_paths if storage.exists(p)]
    assert len(remaining) == 1

    ts.gc()
    remaining = [p for p in old_paths if storage.exists(p)]
    assert len(remaining) == 0

    # the previous generation was never touched
    assert storage.exists(previous_gen_path)


# ============================================================================
# Scenario: _ammortized_gc's probabilistic trigger, invoked via put(), is a
# deterministic function of random.random() vs. the computed threshold.
# ============================================================================
def test_amortized_gc_triggers_probabilistically_on_put(tmpdir, monkeypatch):
    storage = FileObjStore(str(tmpdir.mkdir("storage")))
    clock = FakeClock(t=1000)
    aggression_factor = 10
    max_delete_count = 50
    ts = Tempspace(storage, interval=10, clock=clock, max_delete_count=max_delete_count)
    threshold = aggression_factor / max_delete_count  # 0.2

    ts.gc = MagicMock(wraps=ts.gc)

    # above the threshold: gc() should never fire
    monkeypatch.setattr(
        "breadbox.service.tempspace.random.random", lambda: threshold + 0.01
    )
    for i in range(5):
        path, _found = ts.get_path_if_exists(f"name-above-{i}")
        ts.put(_write_local_file(tmpdir, f"data{i}"), path)
    assert ts.gc.call_count == 0

    # below the threshold: gc() should fire on every put()
    monkeypatch.setattr(
        "breadbox.service.tempspace.random.random", lambda: threshold - 0.01
    )
    for i in range(5):
        path, _found = ts.get_path_if_exists(f"name-below-{i}")
        ts.put(_write_local_file(tmpdir, f"data{i}"), path)
    assert ts.gc.call_count == 5


# ============================================================================
# Scenario: a file is deleted (e.g. by a concurrent gc()) between the exists()
# check and the copy() in get_path_if_exists -- this must be handled gracefully.
# ============================================================================
def test_get_path_if_exists_handles_concurrent_deletion_race(tmpdir):
    storage = RaceyFileObjStore(str(tmpdir.mkdir("storage")))
    clock = FakeClock(t=1000)
    ts = Tempspace(storage, interval=10, clock=clock, max_delete_count=50)

    # seed a file only in the "previous" generation relative to current time
    previous_gen_path = ts._make_path(ts._get_current_interval_index() - 1, "myfile")
    storage.put(_write_local_file(tmpdir, "hello"), previous_gen_path)

    path, found = ts.get_path_if_exists("myfile")
    assert not found
